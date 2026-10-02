import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Send, ImagePlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Reusable task chat for customer & PA.
export default function ChatPanel({ taskId, height = "h-80" }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const endRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/tasks/${taskId}/messages`);
      setMessages(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [taskId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text && !image) return;
    try {
      await api.post(`/tasks/${taskId}/messages`, { text, image });
      setText(""); setImage("");
      load();
    } catch {}
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col" data-testid="chat-panel">
      <div className={`${height} overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-xl`}>
        {messages.length === 0 && <p className="text-center text-xs text-slate-400 mt-6">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                mine ? "bg-orange-500 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
              }`}>
                {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_name || m.sender_role}</p>}
                {m.image && <img src={m.image} alt="attachment" className="rounded-lg mb-1 max-h-40" />}
                {m.text && <p>{m.text}</p>}
                <p className={`text-[9px] mt-0.5 ${mine ? "text-orange-100" : "text-slate-400"}`}>
                  {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {image && (
        <div className="px-3 pt-2"><img src={image} alt="preview" className="h-16 rounded-lg" /></div>
      )}
      <div className="flex items-center gap-2 p-2">
        <label className="p-2 rounded-full hover:bg-slate-100 cursor-pointer" data-testid="chat-attach">
          <ImagePlus className="h-5 w-5 text-slate-500" />
          <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…" data-testid="chat-input"
          className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
        <button onClick={send} data-testid="chat-send"
          className="h-10 w-10 rounded-full bg-orange-500 text-white flex items-center justify-center active:scale-95 transition-transform">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
