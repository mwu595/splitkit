import React, { useState } from 'react';
import { colors } from './styles/tokens.js';
import { useSession }  from './hooks/useSession.js';
import { useProject }  from './hooks/useProject.js';

import Landing         from './components/Landing.jsx';
import Dashboard       from './components/Dashboard.jsx';
import Summary         from './components/Summary.jsx';
import Analytics       from './components/Analytics.jsx';
import Profile         from './components/Profile.jsx';
import AnimatedScreen  from './components/ui/AnimatedScreen.jsx';
import BottomSheet     from './components/ui/BottomSheet.jsx';
import AddTransaction  from './components/AddTransaction.jsx';
import EditTransaction from './components/EditTransaction.jsx';
import InstallPrompt   from './components/InstallPrompt.jsx';

export default function App() {
  const { session, setSession } = useSession();

  const [activeTab,    setActiveTab]    = useState('dashboard');
  const [addOpen,      setAddOpen]      = useState(false);
  const [editTx,       setEditTx]       = useState(null);
  const [showProfile,  setShowProfile]  = useState(false);

  const { project, members, transactions, loading } = useProject(session?.code);

  if (!session) {
    return <Landing onSessionCreated={setSession} />;
  }

  const currentMember = members.find(m => m.id === session.memberId);

  function handleLeave() {
    setSession(null);
    setActiveTab('dashboard');
    setShowProfile(false);
  }

  // ── Active screen ─────────────────────────────────────────────────────────
  const commonProps = {
    session,
    members,
    transactions,
    activeTab,
    onTabChange: setActiveTab,
    onOpenProfile: () => setShowProfile(true),
  };

  let screen;
  if (activeTab === 'dashboard') {
    screen = (
      <Dashboard
        {...commonProps}
        project={project}
        loading={loading}
        onAddExpense={() => setAddOpen(true)}
        onEditTx={tx => setEditTx(tx)}
      />
    );
  } else if (activeTab === 'summary') {
    screen = <Summary {...commonProps} />;
  } else if (activeTab === 'analytics') {
    screen = <Analytics {...commonProps} />;
  }

  return (
    <div className="app-container" style={{ background: colors.bg }}>
      <AnimatedScreen screenKey={activeTab}>
        {screen}
      </AnimatedScreen>

      {/* ── Profile bottom sheet ──────────────────────────────── */}
      <BottomSheet
        open={showProfile}
        onClose={() => setShowProfile(false)}
        title="Profile"
      >
        <Profile
          session={session}
          members={members}
          currentMember={currentMember}
          onLeave={handleLeave}
        />
      </BottomSheet>

      {/* ── Install prompt ───────────────────────────────────── */}
      <InstallPrompt />

      {/* ── Modals ────────────────────────────────────────────── */}
      <AddTransaction
        open={addOpen}
        onClose={() => setAddOpen(false)}
        session={session}
        members={members}
      />
      <EditTransaction
        open={!!editTx}
        onClose={() => setEditTx(null)}
        session={session}
        members={members}
        transaction={editTx}
      />
    </div>
  );
}
