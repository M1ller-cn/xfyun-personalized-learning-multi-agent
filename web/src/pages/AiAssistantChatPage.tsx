import React, { useState } from 'react';
import AiChatPanel from '../components/chat/AiChatPanel';
import { DigitalHumanCoach } from '../components/digital-human';

// ============ AI 助手聊天页面（薄包装层，复用 AiChatPanel） ============
// AiChatPanel 内部通过 useParams 获取 assistantId，自动切换为助手模式

const AiAssistantChatPage: React.FC = () => {
  const [lastReply, setLastReply] = useState('');

  return (
    <div className="flex h-[calc(100vh-7.5rem)] bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl ring-1 ring-gray-200/40 dark:ring-gray-700/30 overflow-hidden">
      <AiChatPanel onAssistantReply={setLastReply} />
      <DigitalHumanCoach lastReply={lastReply} />
    </div>
  );
};

export default AiAssistantChatPage;
