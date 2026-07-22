import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IconSearch } from './icons';
import type { Conversation, Project } from '../../shared/types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (convId: string, projectPath: string | null) => void;
  projects: Project[];
}

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen, onClose, onSelect, projects
}) => {
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.deepseekApi.getConversations().then(data => {
        setConversations(data as Conversation[]);
      }).catch(err => console.error(err));

      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations.slice(0, 50);
    const q = query.toLowerCase();
    return conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.project_path && c.project_path.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [conversations, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (filtered[selectedIndex]) {
          const item = filtered[selectedIndex];
          onSelect(item.id, item.project_path);
          e.preventDefault();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (filtered[idx]) {
          const item = filtered[idx];
          onSelect(item.id, item.project_path);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, onSelect]);

  const getProjectName = (path: string | null) => {
    if (!path) return '未归类';
    const proj = projects.find(p => p.path === path);
    return proj ? proj.name : path.split('/').pop() || '未知';
  };

  if (!isOpen) return null;

  return (
    <>
      {isOpen && (
        <>
          {              }
          <div
            className="fixed inset-0 bg-black/10 z-50 [-webkit-app-region:no-drag]"
            onClick={onClose}
          />
          {                     }
          <div className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-[15vh]">
            <div
              className="pointer-events-auto w-[600px] bg-bg-main rounded-[14px] shadow-floating border border-hairline flex flex-col [-webkit-app-region:no-drag] animate-[menu-in_150ms_ease-out]"
            >
              {                   }
              <div className="flex items-center px-4 py-3 border-b border-hairline gap-3">
                <span className="text-text-secondary w-5 h-5 flex items-center justify-center">
                  <IconSearch />
                </span>
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent border-none outline-none text-[15px] text-text-primary placeholder-text-tertiary"
                  placeholder="搜索对话"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <span className="text-[11px] text-text-tertiary bg-bg-chip px-1.5 py-0.5 rounded border border-hairline">ESC</span>
              </div>

              {                  }
              <div className="flex-1 overflow-y-auto max-h-[400px] p-2 bg-bg-main pb-3">
                <div className="text-[12px] font-normal text-text-tertiary mb-1.5 px-2.5 mt-2">
                  {query.trim() ? '搜索结果' : '近期对话'}
                </div>

                {filtered.length === 0 ? (
                  <div className="px-2.5 py-8 text-center text-[13px] text-text-tertiary">
                    无匹配对话
                  </div>
                ) : (
                  <ul className="list-none m-0 p-0">
                    {filtered.map((item, idx) => (
                      <li key={item.id}>
                        <button
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[7px] border-none text-left cursor-pointer transition-colors mb-0.5 ${idx === selectedIndex ? 'bg-bg-hover' : 'bg-transparent hover:bg-bg-hover'}`}
                          onClick={() => onSelect(item.id, item.project_path)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <span className={`flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-[13px] ${idx === selectedIndex ? 'text-text-primary font-medium' : 'text-text-primary'}`}>
                            {item.title}
                          </span>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-[12px] text-text-tertiary">
                              {getProjectName(item.project_path)}
                            </span>
                            {idx < 9 && (
                              <span className="text-[11px] text-text-tertiary bg-bg-chip px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                ⌘ {idx + 1}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SearchModal;
