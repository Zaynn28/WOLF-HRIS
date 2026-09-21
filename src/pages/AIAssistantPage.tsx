import { useState } from 'react';
import { Bot, Send, User, Sparkles, AlertTriangle, Info } from 'lucide-react';
import { AIMessage } from '../types';
import { employees, attendance, leaveRequests, departments, documents } from '../data/mockData';

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m the ATRIUM HR Assistant. I can help you with HR queries based on your authorized data. Try asking:\n\n• "How many employees are in F&B?"\n• "Who is absent today?"\n• "Which contracts are expiring soon?"\n• "Show pending leave approvals"\n• "What\'s the overtime summary?"',
      classification: 'INFORMATION',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const processQuery = (query: string): AIMessage => {
    const lowerQuery = query.toLowerCase();
    let response = '';
    let classification: AIMessage['classification'] = 'INFORMATION';

    if (lowerQuery.includes('how many employees') || lowerQuery.includes('headcount')) {
      const deptMatch = Object.values(departments).find(d => lowerQuery.includes(d.name.toLowerCase()) || lowerQuery.includes(d.code.toLowerCase()));
      if (deptMatch) {
        const count = employees.filter(e => e.departmentId === deptMatch.id).length;
        response = `There are **${count} employees** in the ${deptMatch.name} department.\n\nActive: ${employees.filter(e => e.departmentId === deptMatch.id && e.employmentStatus === 'ACTIVE').length}\nOn Leave: ${employees.filter(e => e.departmentId === deptMatch.id && e.employmentStatus === 'ON_LEAVE').length}`;
      } else {
        response = `Total headcount: **${employees.length} employees**\n\n• Active: ${employees.filter(e => e.employmentStatus === 'ACTIVE').length}\n• Probation: ${employees.filter(e => e.employmentStatus === 'PROBATION').length}\n• On Leave: ${employees.filter(e => e.employmentStatus === 'ON_LEAVE').length}`;
      }
    } else if (lowerQuery.includes('absent') || lowerQuery.includes('who is absent')) {
      const absentToday = attendance.filter(a => a.status === 'ABSENT');
      const absentEmps = absentToday.map(a => employees.find(e => e.id === a.employeeId)).filter(Boolean);
      response = `**${absentEmps.length} employee(s) absent today:**\n\n${absentEmps.map(e => `• ${e?.fullName} (${e?.employeeCode})`).join('\n')}\n\n_Note: This does not include employees on approved leave._`;
      if (absentEmps.length > 2) classification = 'ANOMALY';
    } else if (lowerQuery.includes('contract') && (lowerQuery.includes('expir') || lowerQuery.includes('ending'))) {
      const expiring = documents.filter(d => d.documentTypeName === 'Employment Contract' && d.expiryDate);
      response = `**${expiring.length} employment contracts** on file.\n\nContracts with upcoming expiry dates:\n${expiring.map(d => {
        const emp = employees.find(e => e.id === d.employeeId);
        return `• ${emp?.fullName} — expires ${d.expiryDate}`;
      }).join('\n')}\n\n⚠️ _Review recommended for contracts expiring within 60 days._`;
      classification = 'ANOMALY';
    } else if (lowerQuery.includes('pending') && lowerQuery.includes('leave')) {
      const pending = leaveRequests.filter(l => l.status === 'PENDING');
      response = `**${pending.length} pending leave request(s):**\n\n${pending.map(l => {
        const emp = employees.find(e => e.id === l.employeeId);
        return `• ${emp?.fullName} — ${l.startDate} to ${l.endDate} (${l.totalDays} days) — "${l.reason}"`;
      }).join('\n')}\n\n[View Leave Requests →]`;
      if (pending.length > 0) classification = 'ACTION_REQUEST';
    } else if (lowerQuery.includes('overtime')) {
      const approved = attendance.filter(a => a.overtimeMinutes && a.overtimeMinutes > 0);
      const otRequests = leaveRequests.length; // placeholder
      response = `**Overtime Summary:**\n\n• Pending requests: 2\n• Approved this period: 2\n• Total approved hours: 10h\n\nTop overtime employees:\n• Rudi Hermawan — 6h (Emergency AC repair)\n• Sari Rahayu — 4h (Event coverage)`;
    } else if (lowerQuery.includes('late') || lowerQuery.includes('lateness')) {
      const late = attendance.filter(a => a.status === 'LATE');
      response = `**${late.length} employee(s) late today:**\n\n${late.map(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        return `• ${emp?.fullName} — ${a.lateMinutes} minutes late`;
      }).join('\n')}`;
      if (late.length > 2) classification = 'ANOMALY';
    } else if (lowerQuery.includes('payroll') || lowerQuery.includes('salary')) {
      response = `**Payroll Status:**\n\n• Current period: 2026-01\n• Status: CALCULATED\n• Employees: 12\n• Total net pay: IDR 76,335,000\n• Pay date: 2026-02-05\n\n_Navigate to Payroll module for detailed breakdown._`;
    } else {
      response = `I understand you're asking about "${query}". Let me help clarify what I can assist with:\n\n• Employee queries (headcount, departments, status)\n• Attendance queries (present, absent, late)\n• Leave management (pending requests, balances)\n• Overtime tracking\n• Contract information\n• Payroll status\n\nPlease try rephrasing your question or select from the suggestions above.`;
      classification = 'SUGGESTION';
    }

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: response,
      classification,
      timestamp: new Date().toISOString(),
    };
  };

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const response = processQuery(input);
      setMessages(prev => [...prev, response]);
      setIsProcessing(false);
    }, 800);
  };

  const quickQuestions = [
    'How many employees are in F&B?',
    'Who is absent today?',
    'Show pending leave approvals',
    'Which contracts are expiring soon?',
  ];

  const classificationBadge = (type?: string) => {
    switch(type) {
      case 'INFORMATION': return <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded"><Info size={10} /> Information</span>;
      case 'SUGGESTION': return <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded"><Sparkles size={10} /> Suggestion</span>;
      case 'ANOMALY': return <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded"><AlertTriangle size={10} /> Anomaly Alert</span>;
      case 'ACTION_REQUEST': return <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded"><AlertTriangle size={10} /> Action Required</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bot size={24} className="text-indigo-600" /> AI HR Assistant
        </h1>
        <p className="text-slate-500 text-sm mt-1">Ask questions about HR data. AI reads authorized data and provides insights.</p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-indigo-600" />
                </div>
              )}
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 border border-slate-200'} rounded-xl px-4 py-3`}>
                {msg.role === 'assistant' && msg.classification && (
                  <div className="mb-2">{classificationBadge(msg.classification)}</div>
                )}
                <div className={`text-sm whitespace-pre-line ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                  {msg.content.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
                  )}
                </div>
                <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-slate-600" />
                </div>
              )}
            </div>
          ))}
          {isProcessing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <Bot size={16} className="text-indigo-600" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-500 mb-2">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about HR data..."
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isProcessing}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">AI responses are based on authorized system data. Always verify before making decisions.</p>
        </div>
      </div>
    </div>
  );
}
