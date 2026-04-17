import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Home from './Home'
import AboutUS from './AboutUS'
import ProtectedRoute from './Components/ProtectedRoute'
import ScrollToTop from './Components/ScrollToTop'
import Login from './Login'
import RegisterParticipant from './RegisterParticipant'
import RegisterCoordinator from './RegisterCoordinator'
import Footer from './Components/Footer'
import Events from './Events'
import NotFound from './NotFound'
import AdminDashboard from './pages/admin/AdminDashboard'
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard'
import ParticipantDashboard from './pages/participant/ParticipantDashboard'
import ViewUsers from './pages/admin/ViewUsers'
import CreateEvent from './pages/coordinator/CreateEvent'
import CoordinatorLayout from './pages/coordinator/CoordinatorLayout'
import AdminLayout from './pages/admin/AdminLayout'
import ViewParticipant from './pages/coordinator/ViewParticipant'
import EventParticipants from './pages/coordinator/EventParticipants'
import AdminEvent from './pages/admin/AdminEvent'
import AdminVenues from './pages/admin/AdminVenues'
import ReportPage from './pages/coordinator/ReportPage'
import AdminReports from './pages/admin/Adminreports'
import Profile from './pages/shared/Profile'
import ParticipantLayout from './pages/participant/ParticipantLayout'
import ViewEvent from './pages/participant/ViewEvent'
import ParticipantCertificates from './pages/participant/ParticipantCertificates'
import ParticipantFeedback from './pages/participant/ParticipantFeedback'
import ParticipantEventPasses from './pages/participant/ParticipantEventPasses'
import Messages from './pages/shared/Messages'
import Banned from './pages/shared/Banned'
import CoordinatorEventFeedback from './pages/coordinator/CoordinatorEventFeedback'
import CoordinatorCheckIn from './pages/coordinator/CoordinatorCheckIn'


function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/AboutUS" element={<AboutUS />} />
          <Route path="/Login" element={<Login />} />
          <Route path="/RegisterParticipant" element={<RegisterParticipant />} />
          <Route path="/RegisterCoordinator" element={<RegisterCoordinator />} />
          <Route path="/Footer" element={<Footer />} />
          <Route path="/Events" element={<Events />} />
          <Route path="/banned" element={<Banned />} />
          <Route path="*" element={<NotFound />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="Users" element={<ViewUsers />} />
            <Route path="Events" element={<AdminEvent />} />
            <Route path="Venues" element={<AdminVenues />} />
            <Route path="Reports" element={<AdminReports />} />
            <Route path="Profile" element={<Profile />} />
            <Route path="Messages" element={<Messages />} />
          </Route>


          {/* Coordinator Routes */}
          <Route
            path="/coordinator"
            element={
              <ProtectedRoute role="coordinator">
                <CoordinatorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CoordinatorDashboard />} />
            <Route path="CreateEvent" element={<CreateEvent />} />
            <Route path="ViewParticipant" element={<ViewParticipant />} />
            <Route path="events/:eventId/participants" element={<EventParticipants />} />
            <Route path="events/:eventId/check-in" element={<CoordinatorCheckIn />} />
            <Route path="events/:eventId/feedback" element={<CoordinatorEventFeedback />} />
            <Route path="report/:participantId" element={<ReportPage />} />
            <Route path="Profile" element={<Profile />} />
            <Route path="Messages" element={<Messages />} />
          </Route>


          {/* Participant Routes */}
          <Route
            path="/participant"
            element={
              <ProtectedRoute role="participant">
                <ParticipantLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ParticipantDashboard />} />
            <Route path="Profile" element={<Profile />} />
            <Route path="ViewEvents" element={<ViewEvent />} />
            <Route path="Passes" element={<ParticipantEventPasses />} />
            <Route path="Certificates" element={<ParticipantCertificates />} />
            <Route path="Feedback" element={<ParticipantFeedback />} />
            <Route path="Messages" element={<Messages />} />
          </Route>

        </Routes>
      </Router>
    </>
  )
}

export default App
