/**
 * Student Invitations Page
 *
 * Students can review, accept, or reject class invitations from teachers.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Badge, Alert } from '@/components/ui';
import { invitationsApi } from '@/lib/api';
import type { InvitationResponse } from '@/lib/types';
import {
  Mail,
  Check,
  X,
  Clock,
  Building2,
  BookOpen,
  User,
} from 'lucide-react';

type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected';

export default function Invitations() {
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invitationsApi.list();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleRespond = async (id: string, action: 'accept' | 'reject') => {
    setRespondingId(id);
    setError(null);
    try {
      const updated = await invitationsApi.respond(id, action);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === id ? updated : inv)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} invitation`);
    } finally {
      setRespondingId(null);
    }
  };

  const filtered = invitations.filter((inv) =>
    filter === 'all' ? true : inv.status === filter,
  );

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;
  const acceptedCount = invitations.filter((i) => i.status === 'accepted').length;
  const rejectedCount = invitations.filter((i) => i.status === 'rejected').length;

  const filters: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: invitations.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'accepted', label: 'Accepted', count: acceptedCount },
    { key: 'rejected', label: 'Rejected', count: rejectedCount },
  ];

  return (
    <DashboardLayout
      title="Invitations"
      subtitle="Manage class invitations from your teachers"
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={<Mail className="w-8 h-8 text-text-muted" />}
          title="No Invitations"
          description="You'll receive invitations here when a teacher invites you to their class."
        />
      ) : (
        <div className="space-y-6">
          {/* Filter Tabs */}
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f.key
                    ? 'bg-bg-card text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      filter === f.key
                        ? 'bg-primary/20 text-primary'
                        : 'bg-bg-hover text-text-muted'
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Invitation Cards */}
          <div className="space-y-4">
            {filtered.length === 0 && (
              <p className="text-center text-text-muted py-12">
                No {filter !== 'all' ? filter : ''} invitations
              </p>
            )}
            {filtered.map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                isResponding={respondingId === inv.id}
                onAccept={() => handleRespond(inv.id, 'accept')}
                onReject={() => handleRespond(inv.id, 'reject')}
              />
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ---- Sub-components ---- */

function InvitationCard({
  invitation,
  isResponding,
  onAccept,
  onReject,
}: {
  invitation: InvitationResponse;
  isResponding: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const statusConfig = {
    pending: { variant: 'warning' as const, icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    accepted: { variant: 'success' as const, icon: <Check className="w-3 h-3" />, label: 'Accepted' },
    rejected: { variant: 'danger' as const, icon: <X className="w-3 h-3" />, label: 'Rejected' },
  };

  const status = statusConfig[invitation.status];

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Class Info */}
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-text-primary truncate">
              {invitation.class_name ?? 'Unnamed Class'}
            </h3>
            <Badge variant={status.variant} size="sm">
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          </div>

          {/* Organization */}
          {invitation.organization_name && (
            <div className="flex items-center gap-2 mb-2 text-sm text-text-secondary">
              <Building2 className="w-4 h-4 text-text-muted flex-shrink-0" />
              <span>{invitation.organization_name}</span>
            </div>
          )}

          {/* Invited By */}
          {invitation.invited_by_name && (
            <div className="flex items-center gap-2 mb-2 text-sm text-text-secondary">
              <User className="w-4 h-4 text-text-muted flex-shrink-0" />
              <span>Invited by {invitation.invited_by_name}</span>
            </div>
          )}

          {/* Date */}
          <p className="text-xs text-text-muted">
            {new Date(invitation.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            {invitation.responded_at && (
              <>
                {' · Responded '}
                {new Date(invitation.responded_at).toLocaleDateString()}
              </>
            )}
          </p>
        </div>

        {/* Actions (only for pending) */}
        {invitation.status === 'pending' && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<X className="w-4 h-4" />}
              onClick={onReject}
              disabled={isResponding}
              className="text-danger hover:bg-danger/10"
            >
              Reject
            </Button>
            <Button
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={onAccept}
              isLoading={isResponding}
            >
              Accept
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
