import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./css/Messages.css";

const API_URL = "http://localhost:3001";

const getCurrentUserId = () => {
  const token = localStorage.getItem("token");
  if (!token) return "";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id || "";
  } catch {
    return "";
  }
};

function Messages() {
  const token = localStorage.getItem("token");
  const currentUserId = getCurrentUserId();
  const socketRef = useRef(null);
  const activeConversationIdRef = useRef("");
  const threadRef = useRef(null);
  const bottomRef = useRef(null);
  const previousMessageCountRef = useRef(0);

  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [sidebarView, setSidebarView] = useState("conversations");
  const [showDetails, setShowDetails] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [activeMessageActionId, setActiveMessageActionId] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const activeConversation = conversations.find(
    (conversation) => conversation._id === activeConversationId
  );
  const conversationsWithMessages = conversations.filter((conversation) =>
    Boolean(conversation.lastMessage)
  );
  const normalizedSidebarSearch = sidebarSearch.trim().toLowerCase();

  const getOtherParticipant = (conversation) =>
    conversation?.participants?.find((participant) => participant._id !== currentUserId);

  const getMessageSenderId = (message) =>
    typeof message?.sender === "string" ? message.sender : message?.sender?._id || "";

  const isDeletedMessage = (message) => Boolean(message?.isDeleted);

  const matchesUserSearch = (user) => {
    if (!normalizedSidebarSearch) return true;

    const searchableText = [user?.username, user?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSidebarSearch);
  };

  const filteredConversations = conversationsWithMessages.filter((conversation) =>
    matchesUserSearch(getOtherParticipant(conversation))
  );
  const filteredContacts = contacts.filter((contact) => matchesUserSearch(contact));

  const getUserImageUrl = (user) => {
    if (user?.profileImage && user.profileImage !== "default.png") {
      return `${API_URL}/uploads/${user.profileImage}`;
    }
    return `${API_URL}/uploads/default.png`;
  };

  const getDayLabel = (dateInput) => {
    const date = new Date(dateInput);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sortConversations = (items) =>
    [...items].sort(
      (a, b) =>
        new Date(b.lastMessageAt || b.updatedAt || 0) - new Date(a.lastMessageAt || a.updatedAt || 0)
    );

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await axios.get(`${API_URL}/conversations`, authHeaders);
      const items = Array.isArray(response.data) ? response.data : [];
      setConversations(sortConversations(items));
      return items;
    } catch (err) {
      console.error(err);
      setError("Failed to load conversations.");
      return [];
    } finally {
      setLoadingConversations(false);
    }
  };

  const markAllUnreadAsRead = async (conversationItems = []) => {
    const unreadItems = (conversationItems || []).filter(
      (conversation) => (conversation.unreadCount || 0) > 0
    );
    if (unreadItems.length === 0) return;

    await Promise.allSettled(
      unreadItems.map((conversation) =>
        axios.patch(`${API_URL}/conversations/${conversation._id}/read`, {}, authHeaders)
      )
    );

    setConversations((prev) =>
      prev.map((conversation) => ({ ...conversation, unreadCount: 0 }))
    );
  };

  const fetchContacts = async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/contacts`, authHeaders);
      setContacts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (conversationId) => {
    if (!conversationId) return;
    try {
      setLoadingMessages(true);
      const response = await axios.get(
        `${API_URL}/conversations/${conversationId}/messages`,
        authHeaders
      );
      setMessages(Array.isArray(response.data) ? response.data : []);
      await axios.patch(`${API_URL}/conversations/${conversationId}/read`, {}, authHeaders);
    } catch (err) {
      console.error(err);
      setError("Failed to load messages.");
    } finally {
      setLoadingMessages(false);
    }
  };

  const openOrCreateConversation = async (participantId) => {
    try {
      const response = await axios.post(
        `${API_URL}/conversations`,
        { participantId },
        authHeaders
      );
      const created = response.data;

      setConversations((prev) => {
        const exists = prev.some((conversation) => conversation._id === created._id);
        if (exists) {
          return sortConversations(
            prev.map((conversation) =>
              conversation._id === created._id ? { ...conversation, ...created } : conversation
            )
          );
        }
        return sortConversations([created, ...prev]);
      });

      setActiveConversationId(created._id);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not start conversation.");
    }
  };

  const sendMessage = async () => {
    if (!activeConversationId) return;
    const content = newMessage.trim();
    if (!content) return;

    try {
      const response = await axios.post(
        `${API_URL}/conversations/${activeConversationId}/messages`,
        { content },
        authHeaders
      );

      const createdMessage = response.data;
      setMessages((prev) => {
        if (prev.some((message) => message._id === createdMessage._id)) {
          return prev;
        }
        return [...prev, createdMessage];
      });
      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation._id === activeConversationId
              ? {
                  ...conversation,
                  lastMessage: createdMessage,
                  lastMessageAt: createdMessage.createdAt,
                  hasSentMessage: true,
                }
              : conversation
          )
        )
      );
      setNewMessage("");
    } catch (err) {
      console.error(err);
      setError("Failed to send message.");
    }
  };

  const replaceMessageInState = (updatedMessage) => {
    setMessages((prev) =>
      prev.map((message) => (message._id === updatedMessage._id ? { ...message, ...updatedMessage } : message))
    );

    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation._id === activeConversationIdRef.current &&
          conversation.lastMessage?._id === updatedMessage._id
            ? {
                ...conversation,
                lastMessage: { ...conversation.lastMessage, ...updatedMessage },
                lastMessageAt: updatedMessage.createdAt || conversation.lastMessageAt,
              }
            : conversation
        )
      )
    );
  };

  const deleteMessage = async (message) => {
    if (!activeConversationId || !message?._id || isDeletedMessage(message)) return;

    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    try {
      setDeletingMessageId(message._id);
      setActiveMessageActionId("");
      const response = await axios.patch(
        `${API_URL}/conversations/${activeConversationId}/messages/${message._id}/delete`,
        {},
        authHeaders
      );
      replaceMessageInState(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to delete message.");
    } finally {
      setDeletingMessageId("");
    }
  };

  useEffect(() => {
    if (!token) return;

    const initialize = async () => {
      const items = await fetchConversations();
      fetchContacts();
      await markAllUnreadAsRead(items);
    };

    initialize();
  }, [token]);

  useEffect(() => {
    if (!activeConversationId) return;
    previousMessageCountRef.current = 0;
    fetchMessages(activeConversationId);
    setShowDetails(false);
  }, [activeConversationId]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("message:new", ({ conversationId, message }) => {
      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) => {
            if (conversation._id !== conversationId) return conversation;
            const senderId =
              typeof message.sender === "string" ? message.sender : message.sender?._id;
            return {
              ...conversation,
              lastMessage: message,
              lastMessageAt: message.createdAt,
              hasSentMessage: conversation.hasSentMessage || senderId === currentUserId,
              unreadCount:
                senderId === currentUserId ? 0 : (conversation.unreadCount || 0) + 1,
            };
          })
        )
      );

      if (conversationId === activeConversationIdRef.current) {
        setMessages((prev) => {
          if (prev.some((existing) => existing._id === message._id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
    });

    socket.on("message:deleted", ({ conversationId, message }) => {
      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation._id === conversationId &&
            conversation.lastMessage?._id === message._id
              ? {
                  ...conversation,
                  lastMessage: { ...conversation.lastMessage, ...message },
                }
              : conversation
          )
        )
      );

      if (conversationId === activeConversationIdRef.current) {
        setMessages((prev) =>
          prev.map((existing) =>
            existing._id === message._id ? { ...existing, ...message } : existing
          )
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, token]);

  useEffect(() => {
    if (!socketRef.current || !activeConversationId) return;
    socketRef.current.emit("conversation:join", activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || messages.length === 0) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    const previousMessageCount = previousMessageCountRef.current;
    const latestMessage = messages[messages.length - 1];
    const latestIsMine = getMessageSenderId(latestMessage) === currentUserId;
    const distanceFromBottom =
      thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    const shouldScroll =
      previousMessageCount === 0 || distanceFromBottom < 120 || latestIsMine;

    if (shouldScroll) {
      bottomRef.current?.scrollIntoView({
        behavior: previousMessageCount === 0 ? "auto" : "smooth",
        block: "end",
      });
    }

    previousMessageCountRef.current = messages.length;
  }, [currentUserId, messages]);

  const handleConversationClick = async (conversationId) => {
    setActiveConversationId(conversationId);
    try {
      await axios.patch(`${API_URL}/conversations/${conversationId}/read`, {}, authHeaders);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="messages-page">
      <div className="messages-shell">
        <aside className="messages-sidebar">
          <div className="messages-card messages-sidebar-panel">
            <div className="messages-sidebar-switcher">
              <button
                className={sidebarView === "conversations" ? "active" : ""}
                onClick={() => setSidebarView("conversations")}
              >
                Conversations
              </button>
              <button
                className={sidebarView === "contacts" ? "active" : ""}
                onClick={() => setSidebarView("contacts")}
              >
                New Chat
              </button>
            </div>

            <div className="messages-tab-content">
              {sidebarView === "conversations" ? (
                <>
                  <h3>Conversations</h3>
                  <div className="messages-sidebar-search">
                    <input
                      type="text"
                      value={sidebarSearch}
                      onChange={(event) => setSidebarSearch(event.target.value)}
                      placeholder="Search users..."
                      aria-label="Search conversations"
                    />
                  </div>
                  {loadingConversations ? (
                    <p className="messages-muted">Loading conversations...</p>
                  ) : conversationsWithMessages.length === 0 ? (
                    <p className="messages-muted">No conversations yet.</p>
                  ) : filteredConversations.length === 0 ? (
                    <p className="messages-muted">No matching users found.</p>
                  ) : (
                    <ul className="conversation-list">
                      {filteredConversations.map((conversation) => {
                        const other = getOtherParticipant(conversation);
                        const unreadCount = conversation.unreadCount || 0;
                        return (
                          <li key={conversation._id}>
                            <button
                              className={`conversation-item ${
                                conversation._id === activeConversationId ? "active" : ""
                              }`}
                              onClick={() => handleConversationClick(conversation._id)}
                            >
                              <div className="messages-list-user">
                                <img
                                  className="messages-list-avatar"
                                  src={getUserImageUrl(other)}
                                  alt={other?.username || "User"}
                                  onError={(event) => {
                                    event.currentTarget.src = `${API_URL}/uploads/default.png`;
                                  }}
                                />
                                <div className="messages-list-content">
                                  <div className="conversation-head">
                                    <span>{other?.username || "Unknown User"}</span>
                                    {unreadCount > 0 ? (
                                      <small className="unread-dot">{unreadCount}</small>
                                    ) : null}
                                  </div>
                                  <small className="messages-muted">
                                    {conversation.lastMessage?.content || "No messages yet"}
                                  </small>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <h3>Start New Chat</h3>
                  <div className="messages-sidebar-search">
                    <input
                      type="text"
                      value={sidebarSearch}
                      onChange={(event) => setSidebarSearch(event.target.value)}
                      placeholder="Search users..."
                      aria-label="Search contacts"
                    />
                  </div>
                  {contacts.length === 0 ? (
                    <p className="messages-muted">No contacts available.</p>
                  ) : filteredContacts.length === 0 ? (
                    <p className="messages-muted">No matching users found.</p>
                  ) : (
                    <ul className="contact-list">
                      {filteredContacts.map((contact) => (
                        <li key={contact._id}>
                          <button onClick={() => openOrCreateConversation(contact._id)}>
                            <div className="messages-list-user">
                              <img
                                className="messages-list-avatar"
                                src={getUserImageUrl(contact)}
                                alt={contact.username || "User"}
                                onError={(event) => {
                                  event.currentTarget.src = `${API_URL}/uploads/default.png`;
                                }}
                              />
                              <div className="messages-list-content">
                                <span className="messages-list-name">{contact.username}</span>
                                {/* <small className="messages-muted">{contact.email}</small> */}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>

        <section className="messages-chat-panel">
          {!activeConversation ? (
            <div className="messages-empty">Message your friends or colleagues.</div>
          ) : (
            <>
              <header className="messages-chat-header">
                <div className="messages-chat-user">
                  <img
                    className="messages-chat-avatar"
                    src={getUserImageUrl(getOtherParticipant(activeConversation))}
                    alt={getOtherParticipant(activeConversation)?.username || "User"}
                    onError={(event) => {
                      event.currentTarget.src = `${API_URL}/uploads/default.png`;
                    }}
                  />
                  <div>
                    <h3>{getOtherParticipant(activeConversation)?.username || "Chat"}</h3>
                    <small className="messages-muted">
                      {getOtherParticipant(activeConversation)?.role || ""}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="messages-details-btn"
                  onClick={() => setShowDetails((prev) => !prev)}
                >
                  {showDetails ? "Hide Details" : "Details"}
                </button>
              </header>
              {showDetails ? (
                <div className="messages-user-details">
                  <p>
                    <strong>Username:</strong>{" "}
                    {getOtherParticipant(activeConversation)?.username || "N/A"}
                  </p>
                  <p>
                    <strong>Email:</strong>{" "}
                    {getOtherParticipant(activeConversation)?.email || "N/A"}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {getOtherParticipant(activeConversation)?.phone || "N/A"}
                  </p>
                </div>
              ) : null}

              <div className="messages-thread" ref={threadRef}>
                {loadingMessages ? (
                  <p className="messages-muted">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p className="messages-muted">No messages yet. Say hello.</p>
                ) : (
                  messages.map((message, index) => {
                    const isMine = getMessageSenderId(message) === currentUserId;
                    const currentDayLabel = getDayLabel(message.createdAt);
                    const previousDayLabel =
                      index > 0 ? getDayLabel(messages[index - 1].createdAt) : "";
                    const showDayDivider = index === 0 || currentDayLabel !== previousDayLabel;

                    return (
                      <React.Fragment key={message._id}>
                        {showDayDivider ? (
                          <div className="messages-day-divider">
                            <span>{currentDayLabel}</span>
                          </div>
                        ) : null}
                        <div className={`message-row ${isMine ? "mine" : "theirs"}`}>
                          <div
                            className={`message-bubble ${isMine ? "mine" : "theirs"} ${
                              isDeletedMessage(message) ? "deleted" : ""
                            } ${activeMessageActionId === message._id ? "actions-open" : ""}`}
                            onClick={() => {
                              if (!isMine || isDeletedMessage(message)) return;
                              setActiveMessageActionId((currentId) =>
                                currentId === message._id ? "" : message._id
                              );
                            }}
                          >
                            {isMine && !isDeletedMessage(message) ? (
                              <button
                                type="button"
                                className="message-delete-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteMessage(message);
                                }}
                                disabled={deletingMessageId === message._id}
                                aria-label="Delete message"
                                title="Delete message"
                              >
                                {deletingMessageId === message._id ? (
                                  "..."
                                ) : (
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                      d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7v7m4-7v7M7 7h10l-1 12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 7Z"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </button>
                            ) : null}
                            <p>{message.content}</p>
                            <small className="message-time">
                              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="messages-composer">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sendMessage();
                  }}
                  placeholder="Type a message..."
                  aria-label="Type a message"
                />
                <button onClick={sendMessage}>Send</button>
              </div>
            </>
          )}
          {error ? <p className="messages-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}

export default Messages;
