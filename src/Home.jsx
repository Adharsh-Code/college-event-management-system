import React from "react";
import { Link } from "react-router-dom";
import "./css/home.css";
import Footer from "./Components/Footer";
import Nav from "./Components/Nav";

const highlights = [
  { value: "All-in-One", label: "Event planning and coordination" },
  { value: "Role-Based", label: "Admin, coordinator, participant flows" },
  { value: "Live Insights", label: "Reports and performance visibility" },
];

const features = [
  {
    title: "Smart Event Setup",
    description: "Create, publish, and manage events with clear timelines and structured details.",
  },
  {
    title: "Participant Management",
    description: "Track registrations, monitor attendance, and keep participant activity organized.",
  },
  {
    title: "Coordinator Workflow",
    description: "Assign responsibilities and streamline communication across organizing teams.",
  },
  {
    title: "Reporting and Governance",
    description: "Review reports, apply moderation actions, and maintain event quality standards.",
  },
];

function Home() {
  return (
    <>
      <Nav />

      <main className="home-page">
        <section className="home-hero">
          <div className="home-hero-content">
            <p className="home-eyebrow">College Event Management Platform</p>
            <h1>Organize Campus Events With Confidence</h1>
            <p className="home-hero-text">
              A professional system to plan, coordinate, and track events from registration to reporting.
            </p>

            <div className="home-hero-actions">
              <Link to="/Login" className="home-btn home-btn-primary">
                Get Started
              </Link>
              <Link to="/AboutUS" className="home-btn home-btn-secondary">
                Learn More
              </Link>
            </div>
          </div>

          <div className="home-hero-panel">
            {highlights.map((item) => (
              <article key={item.label} className="home-highlight-card">
                <h3>{item.value}</h3>
                <p>{item.label}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-features-section">
          <div className="home-section-head">
            <h2>Designed for Modern Campus Operations</h2>
            <p>
              Flexible layouts, reliable workflows, and consistent controls for every stakeholder.
            </p>
          </div>

          <div className="home-features-grid">
            {features.map((feature) => (
              <article key={feature.title} className="home-feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default Home;
