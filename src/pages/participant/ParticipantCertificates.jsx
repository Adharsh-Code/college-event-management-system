import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./css/ParticipantCertificates.css";

const API_BASE = "http://localhost:3001";

const formatCertificateDate = (value) => {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const getAchievementLabel = (certificate) => {
  if (certificate.rank) {
    return `Rank ${certificate.rank}`;
  }
  return certificate.achievementTitle || "Achievement";
};

const buildCertificateHtml = (certificate) => {
  const eventDate = formatCertificateDate(certificate.eventDate);
  const issueDate = formatCertificateDate(certificate.issuedAt);
  const participantName = certificate.recipientName || "Participant";
  const isAchievement = certificate.certificateType === "achievement";
  const achievementLabel = getAchievementLabel(certificate);
  const title = isAchievement ? "Certificate of Achievement" : "Certificate of Participation";
  const subtitle = isAchievement
    ? `Presented in recognition of securing ${achievementLabel}`
      : "Presented in recognition of active participation in an official college event";
  const bodyText = isAchievement
    ? `This is to certify that <strong>${participantName}</strong> achieved <span class="event-name">${achievementLabel}</span> in <span class="event-name">${certificate.eventTitle}</span> and earned an official result published by the event coordinator.`
      : `This is to certify that <strong>${participantName}</strong> successfully participated in <span class="event-name">${certificate.eventTitle}</span> and fulfilled the attendance requirements recorded by the event coordinator.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate - ${certificate.eventTitle}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      padding: 24px;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top left, rgba(28, 88, 176, 0.08), transparent 28%),
        radial-gradient(circle at bottom right, rgba(201, 140, 54, 0.1), transparent 24%),
        #f4efe3;
      color: #1b2940;
    }
    .certificate {
      max-width: 980px;
      margin: 0 auto;
      background: linear-gradient(180deg, #fffdf7 0%, #fffaf0 100%);
      border: 14px solid #d4b06a;
      outline: 2px solid #8e6a2d;
      outline-offset: -18px;
      padding: 56px 64px;
      box-shadow: 0 24px 60px rgba(41, 33, 17, 0.18);
    }
    .top-mark {
      text-align: center;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      font-size: 12px;
      color: #8e6a2d;
      margin-bottom: 16px;
      font-weight: 700;
    }
    h1 {
      margin: 0;
      text-align: center;
      font-size: 50px;
      color: #15345f;
      letter-spacing: 0.06em;
    }
    .subtitle {
      margin: 14px 0 38px;
      text-align: center;
      font-size: 18px;
      color: #6d5b3d;
    }
    .recipient-label {
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      font-size: 12px;
      color: #8a7351;
      margin-bottom: 10px;
    }
    .recipient-name {
      text-align: center;
      font-size: 40px;
      color: #0f2d55;
      margin: 0 0 26px;
      font-weight: 700;
      border-bottom: 2px solid rgba(142, 106, 45, 0.35);
      display: inline-block;
      width: 100%;
      padding-bottom: 12px;
    }
    .body-text {
      text-align: center;
      font-size: 20px;
      line-height: 1.8;
      color: #2f3f57;
      margin: 0 auto 34px;
      max-width: 760px;
    }
    .event-name {
      color: #8d5a17;
      font-weight: 700;
      margin-left: 6px;
    }
    .details {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin: 34px 0 44px;
    }
    .detail-card {
      border: 1px solid rgba(142, 106, 45, 0.24);
      background: rgba(255, 255, 255, 0.72);
      border-radius: 12px;
      padding: 16px 18px;
    }
    .detail-label {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: #8a7351;
      margin-bottom: 7px;
      font-weight: 700;
    }
    .detail-value {
      font-size: 18px;
      color: #17335b;
      font-weight: 600;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: end;
      margin-top: 48px;
    }
    .signature-block {
      min-width: 240px;
    }
    .signature-line {
      border-top: 2px solid #23446f;
      margin-bottom: 8px;
      width: 100%;
    }
    .signature-name {
      font-size: 18px;
      font-weight: 700;
      color: #163056;
    }
    .signature-role {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #7a6849;
      margin-top: 4px;
    }
    .certificate-number {
      text-align: right;
      font-size: 14px;
      color: #6f6045;
      font-weight: 700;
    }
    @page {
      size: A4;
      margin: 12mm;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .certificate {
        box-shadow: none;
        margin: 0 auto;
        max-width: none;
        min-height: calc(297mm - 24mm);
      }
    }
  </style>
</head>
<body>
  <main class="certificate">
    <div class="top-mark">College Event Management</div>
    <h1>${title}</h1>
    <p class="subtitle">${subtitle}</p>
    <div class="recipient-label">Awarded To</div>
    <div class="recipient-name">${participantName}</div>
    <p class="body-text">${bodyText}</p>
    <section class="details">
      <div class="detail-card">
        <span class="detail-label">Event Date</span>
        <span class="detail-value">${eventDate}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Venue</span>
        <span class="detail-value">${certificate.venue || "N/A"}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Issued On</span>
        <span class="detail-value">${issueDate}</span>
      </div>
      ${
        isAchievement
          ? `<div class="detail-card">
        <span class="detail-label">Achievement</span>
        <span class="detail-value">${achievementLabel}</span>
      </div>`
          : ""
      }
      <div class="detail-card">
        <span class="detail-label">Certificate No.</span>
        <span class="detail-value">${certificate.certificateNumber}</span>
      </div>
    </section>
    <div class="footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-name">${certificate.coordinatorName}</div>
        <div class="signature-role">Coordinator</div>
      </div>
      <div class="certificate-number">Verified by College Event Management</div>
    </div>
  </main>
</body>
</html>`;
};

function ParticipantCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("issued_desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");

        const certificatesRes = await axios.get(`${API_BASE}/participant/certificates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCertificates(Array.isArray(certificatesRes.data) ? certificatesRes.data : []);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load certificates");
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, []);

  const filteredCertificates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let data = [...certificates];

    if (normalizedSearch) {
      data = data.filter((certificate) => {
        const searchableText = [
          certificate.eventTitle,
          certificate.venue,
          certificate.coordinatorName,
          certificate.certificateNumber,
          certificate.recipientName,
          certificate.achievementTitle,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      });
    }

    if (sortBy === "issued_desc") {
      data.sort(
        (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
      );
    } else if (sortBy === "issued_asc") {
      data.sort(
        (a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime()
      );
    } else if (sortBy === "event_desc") {
      data.sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
      );
    } else if (sortBy === "event_asc") {
      data.sort(
        (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );
    } else if (sortBy === "title_asc") {
      data.sort((a, b) => (a.eventTitle || "").localeCompare(b.eventTitle || ""));
    } else if (sortBy === "title_desc") {
      data.sort((a, b) => (b.eventTitle || "").localeCompare(a.eventTitle || ""));
    }

    return data;
  }, [certificates, searchTerm, sortBy]);

  const handleDownloadPdf = (certificate) => {
    const certificateHtml = buildCertificateHtml(certificate);
    const iframe = document.createElement("iframe");
    let hasPrinted = false;

    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    const handleLoad = () => {
      if (hasPrinted) return;

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        cleanup();
        return;
      }

      hasPrinted = true;
      frameWindow.onafterprint = cleanup;
      frameWindow.focus();
      setTimeout(() => {
        frameWindow.print();
      }, 250);
    };

    iframe.addEventListener("load", handleLoad, { once: true });
    document.body.appendChild(iframe);
    iframe.srcdoc = certificateHtml;
  };

  if (loading) {
    return <section className="participant-certificates-page"><div className="participant-certificates-state">Loading certificates...</div></section>;
  }

  if (error) {
    return <section className="participant-certificates-page"><div className="participant-certificates-state participant-certificates-error">{error}</div></section>;
  }

  return (
    <section className="participant-certificates-page">
      <header className="participant-certificates-header">
        <div>
          <h1>Certificates</h1>
          <p>Participation and achievement certificates issued for your events.</p>
        </div>
        <div className="participant-certificates-badge">{certificates.length} issued</div>
      </header>

      {certificates.length > 0 ? (
        <section className="participant-certificates-controls">
          <div className="participant-certificates-search">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by event, venue, coordinator, or certificate no..."
            />
          </div>

          <div className="participant-certificates-sort">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="issued_desc">Issued Date: Newest</option>
              <option value="issued_asc">Issued Date: Oldest</option>
              <option value="event_desc">Event Date: Newest</option>
              <option value="event_asc">Event Date: Oldest</option>
              <option value="title_asc">Title: A-Z</option>
              <option value="title_desc">Title: Z-A</option>
            </select>
          </div>
        </section>
      ) : null}

      {certificates.length === 0 ? (
        <div className="participant-certificates-state">
          Certificates will appear here after a coordinator ends an event and confirms your attendance.
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="participant-certificates-state">
          No certificates matched your current search.
        </div>
      ) : (
        <div className="participant-certificates-grid">
          {filteredCertificates.map((certificate) => (
            <article key={certificate.certificateNumber} className="participant-certificate-card">
              <div className="participant-certificate-card-top">
                  <span className="participant-certificate-label">
                    {certificate.certificateType === "achievement"
                      ? getAchievementLabel(certificate)
                      : "Certificate of Participation"}
                  </span>
                <span className="participant-certificate-number">{certificate.certificateNumber}</span>
              </div>

              <h2>{certificate.eventTitle}</h2>
                <p className="participant-certificate-copy">
                  {certificate.certificateType === "achievement"
                    ? `Awarded to ${certificate.recipientName || "Participant"} for securing ${getAchievementLabel(certificate)}.`
                    : `Awarded to ${certificate.recipientName || "Participant"} for verified participation.`}
                </p>

                <div className="participant-certificate-meta">
                  <div>
                    <span>Date</span>
                    <strong>{formatCertificateDate(certificate.eventDate)}</strong>
                  </div>
                <div>
                  <span>Issued</span>
                  <strong>{formatCertificateDate(certificate.issuedAt)}</strong>
                </div>
                <div>
                  <span>Venue</span>
                  <strong>{certificate.venue || "N/A"}</strong>
                </div>
                  <div>
                    <span>Coordinator</span>
                    <strong>{certificate.coordinatorName}</strong>
                  </div>
                  {certificate.certificateType === "achievement" ? (
                    <div>
                      <span>Rank</span>
                      <strong>{certificate.rank || "N/A"}</strong>
                    </div>
                  ) : null}
                </div>

              <button
                type="button"
                className="participant-certificate-download"
                onClick={() => handleDownloadPdf(certificate)}
              >
                Download PDF
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ParticipantCertificates;
