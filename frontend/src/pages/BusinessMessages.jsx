import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Phase5Status from "../components/Phase5Status";

export default function BusinessMessages() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lastMessageId = useRef(0);
  const bottomRef = useRef(null);

  const loadConversations = async () => {
    const response = await api.get("/communication/conversations");
    const items = response.data.conversations || [];
    setConversations(items);
    return items;
  };

  const loadMessages = async (conversationId, incremental = false) => {
    if (!conversationId) return;
    const afterId = incremental ? lastMessageId.current : 0;
    const response = await api.get(
      `/communication/conversations/${conversationId}/messages`,
      { params: { after_id: afterId } }
    );
    const incoming = response.data.messages || [];
    if (incremental) {
      setMessages((current) => {
        const known = new Set(current.map((item) => Number(item.id)));
        return [...current, ...incoming.filter((item) => !known.has(Number(item.id)))];
      });
    } else {
      setMessages(incoming);
    }
    if (incoming.length) {
      lastMessageId.current = Number(incoming[incoming.length - 1].id);
    }
  };

  const loadPage = async () => {
    try {
      setLoading(true);
      setError("");
      const [orderResponse, items] = await Promise.all([
        api.get("/orders/my/list"),
        loadConversations(),
      ]);
      setOrders(orderResponse.data.orders || []);
      if (!activeId && items.length) setActiveId(items[0].id);
    } catch (err) {
      setError(err.response?.data?.message || "Business chat could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      lastMessageId.current = 0;
      return undefined;
    }
    lastMessageId.current = 0;
    loadMessages(activeId);
    const timer = window.setInterval(() => {
      loadMessages(activeId, true).catch(() => {});
      loadConversations().catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async (event) => {
    event.preventDefault();
    if (!orderId) return;
    try {
      setBusy("start");
      setError("");
      const response = await api.post(
        `/communication/orders/${orderId}/conversation`
      );
      const items = await loadConversations();
      const selected =
        items.find(
          (item) => Number(item.id) === Number(response.data.conversation_id)
        ) || items[0];
      if (selected) setActiveId(selected.id);
      setNotice(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start chat");
    } finally {
      setBusy("");
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!activeId || !message) return;
    try {
      setBusy("send");
      setError("");
      setDraft("");
      await api.post(`/communication/conversations/${activeId}/messages`, {
        message,
      });
      await loadMessages(activeId, true);
      await loadConversations();
    } catch (err) {
      setDraft(message);
      setError(err.response?.data?.message || "Message could not be sent");
    } finally {
      setBusy("");
    }
  };

  const activeConversation = conversations.find(
    (item) => Number(item.id) === Number(activeId)
  );
  const availableOrders = orders.filter(
    (order) =>
      order.status !== "rejected" &&
      !conversations.some((item) => Number(item.order_id) === Number(order.id))
  );

  if (loading) {
    return <main className="phase-six-page"><div className="phase-six-loading"><div className="loader"></div><p>Loading secure chats...</p></div></main>;
  }

  return (
    <main className="phase-six-page">
      <div className="phase-six-container">
        <section className="phase-six-page-head">
          <div>
            <p className="phase-six-kicker">Order-linked communication</p>
            <h1>Business Chat</h1>
            <p>Only the verified farmer and distributor on an order can read its messages.</p>
          </div>
          <form className="chat-start-form" onSubmit={startConversation}>
            <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
              <option value="">Start chat for order</option>
              {availableOrders.map((order) => (
                <option value={order.id} key={order.id}>#{order.id} · {order.crop_name}</option>
              ))}
            </select>
            <button className="btn" disabled={!orderId || busy === "start"}>Start</button>
          </form>
        </section>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <section className="business-chat-shell">
          <aside className="conversation-list">
            <div className="conversation-list-head">
              <strong>Conversations</strong><span>{conversations.length}</span>
            </div>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={Number(activeId) === Number(conversation.id) ? "active" : ""}
                onClick={() => setActiveId(conversation.id)}
              >
                <div>
                  <strong>{conversation.counterpart_name}</strong>
                  <small>Order #{conversation.order_id} · {conversation.crop_name}</small>
                  <p>{conversation.last_message || "Chat ready"}</p>
                </div>
                {Number(conversation.unread_count) > 0 && (
                  <span className="chat-unread">{conversation.unread_count}</span>
                )}
              </button>
            ))}
            {!conversations.length && (
              <div className="chat-empty">Choose an order above to start a private business chat.</div>
            )}
          </aside>

          <div className="chat-workspace">
            {activeConversation ? (
              <>
                <header className="chat-workspace-head">
                  <div>
                    <h2>{activeConversation.counterpart_name}</h2>
                    <p>Order #{activeConversation.order_id} · {activeConversation.crop_name} · {activeConversation.quantity} {activeConversation.unit}</p>
                  </div>
                  <Phase5Status value={activeConversation.order_status} />
                </header>
                <div className="chat-message-stream">
                  {messages.map((item) =>
                    item.message_type === "system" ? (
                      <div className="chat-system-message" key={item.id}>{item.message}</div>
                    ) : (
                      <article
                        className={Number(item.sender_id) === Number(user?.id) ? "mine" : "theirs"}
                        key={item.id}
                      >
                        <strong>{Number(item.sender_id) === Number(user?.id) ? "You" : item.sender_name}</strong>
                        <p>{item.message}</p>
                        <time>{new Date(item.created_at).toLocaleString("en-IN")}</time>
                      </article>
                    )
                  )}
                  <div ref={bottomRef}></div>
                </div>
                <form className="chat-compose" onSubmit={sendMessage}>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength="2000"
                    placeholder="Write an order-related message…"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button className="btn" disabled={!draft.trim() || busy === "send"}>
                    {busy === "send" ? "Sending…" : "Send"}
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-workspace-empty"><span>💬</span><h2>Select a conversation</h2><p>Your secure order messages will appear here.</p></div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
