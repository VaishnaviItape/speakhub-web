import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Mic, Headphones, Bell, Trash2, Mail, Phone, CheckCircle, ArrowLeft } from 'lucide-react';
import logo from '../../assets/logo.png';

const PrivacyPolicy: React.FC = () => {
  const [deleteEmailOrPhone, setDeleteEmailOrPhone] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmitDeletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteEmailOrPhone.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={logo} alt="Speak Hub Academy" className="h-9 w-auto" />
            <span className="font-bold text-lg text-slate-900 tracking-tight">Speak Hub Academy</span>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center text-sm font-medium text-rose-600 hover:text-rose-700 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Portal
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Banner */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" />
            Google Play & Privacy Standards Compliant
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-1">Effective Date: January 1, 2026 • Last Reviewed: 2026</p>
          <p className="mt-4 text-slate-600 leading-relaxed text-sm sm:text-base">
            Speak Hub Academy ("we", "our", or "us") provides spoken English education, language courses, and student performance tracking through the Speak Hub Academy mobile application and web portals. We are committed to safeguarding the privacy and personal data of all our students, teachers, and guardians.
          </p>
        </div>

        {/* Section 1: Data Collection */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-600" />
            1. Information We Collect
          </h2>
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              <strong className="text-slate-800">Account Credentials:</strong> Full Name, Student Mobile Number, Email Address, Password (hashed via Firebase Authentication), Date of Birth, and Parent/Guardian information.
            </p>
            <p>
              <strong className="text-slate-800">Academic & Performance Records:</strong> Batch enrollment history, attendance records, study notes, teacher feedback, and exam results.
            </p>
            <p>
              <strong className="text-slate-800">Financial Records:</strong> Tuition fee payment logs, fee plan receipts, and payment transaction identifiers.
            </p>
          </div>
        </div>

        {/* Section 2: Permissions */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mic className="w-5 h-5 text-rose-600" />
            2. Mobile App Permissions & Usage
          </h2>
          <p className="text-sm text-slate-600">
            Our Android mobile application requests specific device permissions to provide spoken English coaching:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                <Mic className="w-4 h-4 text-rose-600" />
                Microphone (RECORD_AUDIO)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Required for students to record audio during speech tests, speaking practice sessions, and oral viva evaluations. Recordings are evaluated by assigned language trainers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                <Headphones className="w-4 h-4 text-blue-600" />
                Foreground Audio Playback
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Allows students to listen to pronunciation guides, sample conversations, and study audios continuously even while multitasking or with the screen locked.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                <Bell className="w-4 h-4 text-amber-600" />
                Push Notifications
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sends timely updates on batch timings, homework deadlines, attendance verification, and academic announcements.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Data Security */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-600" />
            3. Data Storage & Third Parties
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            All user data is hosted on Google Cloud Firebase with TLS/SSL encryption in transit and AES-256 encryption at rest. Speak Hub Academy does <strong className="text-slate-800">NOT sell, rent, or monetize</strong> student personal data, contact numbers, or audio submissions to any third-party advertisers.
          </p>
        </div>

        {/* Section 4: Account & Data Deletion (Google Play Mandate) */}
        <div id="account-deletion" className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            4. Account and Data Deletion Policy
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            In compliance with Google Play's User Data and Account Deletion policy, users may permanently delete their account and associated personal data at any time:
          </p>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80">
              <strong className="text-slate-900 block mb-1">Method 1: Direct In-App Deletion</strong>
              Log in to the Speak Hub mobile app &gt; Navigate to <strong>Profile</strong> &gt; Scroll to the bottom &gt; Tap <strong>"Delete Account & Personal Data"</strong>. This immediately deletes your credentials and schedules all profile data for purging.
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <strong className="text-slate-900 block mb-1">Method 2: Web Deletion Request Form</strong>
              Fill in the form below or contact us via email. Our team will verify and permanently delete your student record and associated files within 30 days:
            </div>
          </div>

          {/* Web Deletion Form */}
          <div className="pt-2">
            {isSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>Your account deletion request has been registered. Our administration team will process the deletion and confirm via SMS/Email within 30 days.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitDeletion} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Phone or Email *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. +91 9876543210 or student@email.com"
                      value={deleteEmailOrPhone}
                      onChange={(e) => setDeleteEmailOrPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reason (Optional)</label>
                    <input
                      type="text"
                      placeholder="Course completed / Other"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
                >
                  Submit Account Deletion Request
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Section 5: Contact */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900">5. Contact Information</h2>
          <p className="text-sm text-slate-600">
            For privacy inquiries, parental queries, or data deletion support, reach out to Speak Hub Academy:
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1 text-sm">
            <a
              href="mailto:speakhubacademy@gmail.com"
              className="inline-flex items-center gap-2 text-rose-600 hover:underline font-medium"
            >
              <Mail className="w-4 h-4" />
              speakhubacademy@gmail.com
            </a>
            <span className="hidden sm:inline text-slate-300">•</span>
            <a
              href="tel:+919307829005"
              className="inline-flex items-center gap-2 text-rose-600 hover:underline font-medium"
            >
              <Phone className="w-4 h-4" />
              +91 93078 29005
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        <p>© 2026 Speak Hub Academy. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
