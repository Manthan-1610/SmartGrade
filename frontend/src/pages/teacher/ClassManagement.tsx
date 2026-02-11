/**
 * Class Management Page
 *
 * Teachers can view all classes, create organizations and classes,
 * and navigate to class details.
 */
import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Input, Alert, Badge } from '@/components/ui';
import { organizationsApi, classesApi } from '@/lib/api';
import type { Organization, ClassResponse, ClassCreate, OrganizationCreate } from '@/lib/types';
import {
  Plus,
  BookOpen,
  Building2,
  Users,
  FileText,
  X,
  Search,
} from 'lucide-react';

export default function ClassManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal state
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [orgs, cls] = await Promise.all([
        organizationsApi.list(),
        classesApi.listTeaching(),
      ]);
      setOrganizations(orgs);
      setClasses(cls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle navigation state triggers (from quick actions)
  useEffect(() => {
    const state = location.state as { createOrg?: boolean; createClass?: boolean } | null;
    if (state?.createOrg) setShowOrgModal(true);
    if (state?.createClass) setShowClassModal(true);
    // Clear the state so it doesn't re-trigger
    if (state) {
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.organization_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout
      title="Class Management"
      subtitle={`${organizations.length} organizations · ${classes.length} classes`}
      headerAction={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Building2 className="w-4 h-4" />}
            onClick={() => setShowOrgModal(true)}
          >
            <span className="hidden sm:inline">New Org</span>
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowClassModal(true)}
            disabled={organizations.length === 0}
          >
            <span className="hidden sm:inline">New Class</span>
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : (
        <div className="space-y-8">
          {/* Organizations */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Organizations</h2>
            {organizations.length === 0 ? (
              <EmptyState
                icon={<Building2 className="w-8 h-8 text-text-muted" />}
                title="No Organizations"
                description="Create an organization to start managing classes."
                action={
                  <Button
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setShowOrgModal(true)}
                  >
                    Create Organization
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="bg-bg-card border border-border rounded-xl p-5 animate-fade-in"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/15 rounded-lg">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-text-primary truncate">{org.name}</h3>
                        {org.description && (
                          <p className="text-xs text-text-muted truncate">{org.description}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {classes.filter((c) => c.organization_id === org.id).length} classes
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Classes */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">All Classes</h2>
              {classes.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search classes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {classes.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8 text-text-muted" />}
                title="No Classes Yet"
                description="Create a class to start inviting students and creating exams."
                action={
                  <Button
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setShowClassModal(true)}
                    disabled={organizations.length === 0}
                  >
                    Create Class
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => navigate(`/classes/${cls.id}`)}
                    className="w-full flex items-center justify-between bg-bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-lg transition-all text-left animate-fade-in"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary">{cls.name}</span>
                        {cls.is_archived && <Badge variant="warning">Archived</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        {cls.organization_name && <span>{cls.organization_name}</span>}
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {cls.student_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {cls.exam_count} exams
                        </span>
                      </div>
                    </div>
                    <span className="text-text-muted text-xs flex-shrink-0 ml-4">
                      {new Date(cls.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
                {filteredClasses.length === 0 && search && (
                  <p className="text-center text-text-muted py-8">
                    No classes match "{search}"
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create Organization Modal */}
      {showOrgModal && (
        <CreateOrgModal
          onClose={() => setShowOrgModal(false)}
          onCreated={() => {
            setShowOrgModal(false);
            loadData();
          }}
        />
      )}

      {/* Create Class Modal */}
      {showClassModal && (
        <CreateClassModal
          organizations={organizations}
          onClose={() => setShowClassModal(false)}
          onCreated={() => {
            setShowClassModal(false);
            loadData();
          }}
        />
      )}
    </DashboardLayout>
  );
}

/* ---- Modal Components ---- */

function CreateOrgModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const data: OrganizationCreate = { name: name.trim() };
      if (description.trim()) data.description = description.trim();
      await organizationsApi.create(data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Create Organization">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Input
          label="Organization Name"
          placeholder="e.g. ABC Coaching Center"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function CreateClassModal({
  organizations,
  onClose,
  onCreated,
}: {
  organizations: Organization[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Class name is required');
      return;
    }
    if (!orgId) {
      setError('Select an organization');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const data: ClassCreate = {
        name: name.trim(),
        organization_id: orgId,
      };
      if (description.trim()) data.description = description.trim();
      await classesApi.create(data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Create Class">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Organization
          </label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Class Name"
          placeholder="e.g. Class 10 - Section A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Class
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
}

/** Reusable centered modal backdrop + card. */
function ModalWrapper({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-2xl w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Re-export ModalWrapper for reuse
export { ModalWrapper };
