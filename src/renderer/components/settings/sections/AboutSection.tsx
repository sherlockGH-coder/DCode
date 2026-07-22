import React, { useEffect, useState } from 'react';

const AboutSection: React.FC = () => {
  const [dbPath, setDbPath] = useState('');

  useEffect(() => {
    window.deepseekApi.getDbPath().then(setDbPath).catch(() => setDbPath('未知'));
  }, []);

  const handleOpenDir = () => {
    window.deepseekApi.openDbDir().catch(console.error);
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.06]">
        <h2 className="text-[22px] font-bold tracking-tight text-text-primary">
          关于
        </h2>
      </div>

      {          }
      <section className="mb-8 pb-6 border-b border-black/[0.05] dark:border-white/[0.05]">
        <h3 className="text-[14px] font-bold text-text-primary mb-1">版本</h3>
        <p className="text-[13px] text-text-secondary font-semibold mt-1.5">DeepSeek-App 0.1.0</p>
      </section>

      {           }
      <section className="mb-8">
        <h3 className="text-[14px] font-bold text-text-primary mb-1.5">数据库位置</h3>
        <p className="text-[12px] text-text-tertiary mb-3.5 font-mono break-all leading-relaxed bg-black/[0.025] dark:bg-white/[0.025] p-3 rounded-lg border border-black/[0.04] dark:border-white/[0.04] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.01)] select-text">
          {dbPath || '加载中...'}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-black/[0.08] dark:border-white/[0.08] rounded-lg bg-white dark:bg-zinc-900 text-[13px] font-semibold text-text-secondary hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:text-text-primary cursor-pointer transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.015)]"
          onClick={handleOpenDir}
        >
          在 Finder 中显示
        </button>
      </section>
    </div>
  );
};

export default AboutSection;
