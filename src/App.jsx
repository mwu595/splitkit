import React, { useState, useEffect } from 'react';
import { colors } from './styles/tokens.js';
import { useSession }  from './hooks/useSession.js';
import { useProject }  from './hooks/useProject.js';
import { useAuth }     from './hooks/useAuth.js';
import { linkMemberToUser } from './lib/db.js';

import Landing         from './components/Landing.jsx';
import Dashboard       from './components/Dashboard.jsx';
import Summary         from './components/Summary.jsx';
import Analytics       from './components/Analytics.jsx';
import MyProjects      from './components/MyProjects.jsx';
import Profile         from './components/Profile.jsx';
import AnimatedScreen  from './components/ui/AnimatedScreen.jsx';
import BottomSheet     from './components/ui/BottomSheet.jsx';
import AddTransaction  from './components/AddTransaction.jsx';
import EditTransaction from './components/EditTransaction.jsx';
import InstallPrompt   from './components/InstallPrompt.jsx';

export default function App() {
  const { session, setSession } = useSession();
  const { authUser }            = useAuth();

  const [activeTab,    setActiveTab]    = useState('dashboard');
  const [addOpen,      setAddOpen]      = useState(false);
  const [editTx,       setEditTx]       = useState(null);
  const [showProfile,  setShowProfile]  = useState(false);

  const { project, members, transactions, loading, refresh } = useProject(session?.code);

  // Auto-link member to auth account whenever the user signs in
  useEffect(() => {
    if (authUser && session?.memberId) {
      linkMemberToUser(session.memberId, authUser.id).catch(err => {
        console.error('[splitkit] auto-link failed:', err.message);
      });
    }
  }, [authUser?.id, session?.memberId]);

  if (!session) {
    return (
      <div className="app-container" style={{ background: colors.bg }}>
        <Landing onSessionCreated={setSession} authUser={authUser} />
      </div>
    );
  }

  const currentMember = members.find(m => m.id === session.memberId);

  function handleLeave() {
    setSession(null);
    setActiveTab('dashboard');
    setShowProfile(false);
  }

  function handleJoinOrCreate() {
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
    currentMember,
    authUser,
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
  } else if (activeTab === 'myprojects') {
    screen = (
      <MyProjects
        {...commonProps}
        onSwitchProject={({ code, memberId }) => {
          setSession({ code, memberId });
          setActiveTab('dashboard');
        }}
      />
    );
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
          project={project}
          onLeave={handleLeave}
          onJoinOrCreate={handleJoinOrCreate}
          refresh={refresh}
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
        onDeleted={() => { setEditTx(null); refresh(); }}
        session={session}
        members={members}
        transaction={editTx}
      />
    </div>
  );
}
