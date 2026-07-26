import asyncio
import json
import os
from pathlib import Path
from typing import override

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


PROTOCOL_PREFIX = "DCODE_BENCH:"


class DCodeAgent(BaseAgent):
    """Run DCode's Electron agent loop against a Harbor task environment."""

    def __init__(
        self,
        *args,
        repo_path: str | None = None,
        max_tool_rounds: int = 50,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.repo_path = Path(repo_path or Path(__file__).resolve().parents[1])
        self.max_tool_rounds = max(1, int(max_tool_rounds))

    @staticmethod
    @override
    def name() -> str:
        return "dcode"

    @override
    def version(self) -> str:
        return "0.1.0"

    @override
    async def setup(self, environment: BaseEnvironment) -> None:
        electron = self.repo_path / "node_modules" / ".bin" / "electron"
        runner = self.repo_path / "out" / "main" / "benchmark-runner.js"
        if not electron.exists():
            raise FileNotFoundError(f"Electron executable not found: {electron}")
        if not runner.exists():
            raise FileNotFoundError(
                f"Benchmark runner not built: {runner}. Run `pnpm build` first."
            )

    @override
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        electron = self.repo_path / "node_modules" / ".bin" / "electron"
        runner = self.repo_path / "out" / "main" / "benchmark-runner.js"
        stderr_path = self.logs_dir / "dcode-runner.stderr.log"
        transcript_path = self.logs_dir / "dcode-tools.log"
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        with (
            stderr_path.open("wb") as stderr_file,
            transcript_path.open("w", encoding="utf-8") as transcript,
        ):
            runner_env = {
                **os.environ,
                "DCODE_BENCHMARK_MAX_TOOL_ROUNDS": str(self.max_tool_rounds),
            }
            process = await asyncio.create_subprocess_exec(
                str(electron),
                str(runner),
                cwd=self.repo_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=stderr_file,
                env=runner_env,
            )
            assert process.stdin is not None
            assert process.stdout is not None
            await self._send(process, {"type": "init", "instruction": instruction})

            try:
                while line := await process.stdout.readline():
                    text = line.decode("utf-8", errors="replace").rstrip("\n")
                    if not text.startswith(PROTOCOL_PREFIX):
                        continue
                    event = json.loads(text[len(PROTOCOL_PREFIX) :])
                    event_type = event.get("type")

                    if event_type == "tool_request":
                        timeout_ms = int(event.get("timeoutMs", 120_000))
                        transcript.write(f"\n$ {event['command']}\n")
                        transcript.flush()
                        result = await environment.exec(
                            command=event["command"],
                            timeout_sec=max(1, min(timeout_ms, 600_000) // 1000),
                        )
                        transcript.write(result.stdout or "")
                        if result.stderr:
                            transcript.write(f"\n[stderr]\n{result.stderr}")
                        transcript.write(f"\n[exit_code={result.return_code}]\n")
                        transcript.flush()
                        await self._send(
                            process,
                            {
                                "type": "tool_response",
                                "id": event["id"],
                                "stdout": result.stdout or "",
                                "stderr": result.stderr or "",
                                "returnCode": result.return_code,
                            },
                        )
                    elif event_type == "result":
                        usage = event.get("usage", {})
                        context.n_input_tokens = usage.get("inputTokens")
                        context.n_output_tokens = usage.get("outputTokens")
                        context.n_cache_tokens = usage.get("cacheTokens")
                        context.metadata = {
                            "final_content": event.get("finalContent", ""),
                            "model": event.get("model"),
                            "max_tool_rounds": self.max_tool_rounds,
                        }
                        break
                    elif event_type == "error":
                        raise RuntimeError(event.get("message", "DCode benchmark runner failed"))
            finally:
                if process.returncode is None:
                    try:
                        process.stdin.close()
                        await asyncio.wait_for(process.wait(), timeout=10)
                    except TimeoutError:
                        process.terminate()
                        await process.wait()

            if process.returncode not in (0, None):
                raise RuntimeError(
                    f"DCode benchmark runner exited with code {process.returncode}; "
                    f"see {stderr_path}"
                )

    @staticmethod
    async def _send(process: asyncio.subprocess.Process, payload: dict) -> None:
        assert process.stdin is not None
        process.stdin.write((json.dumps(payload) + "\n").encode("utf-8"))
        await process.stdin.drain()
