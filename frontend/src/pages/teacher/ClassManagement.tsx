/**
 * Class Management Page
 *
 * Teachers can view all their classes and create new ones.
 * Organization is automatically assigned (each teacher has one org created during signup).
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
import type { OrganizationDetail, ClassResponse, ClassCreate } from '@/lib/types';
import {
  Plus,
  BookOpen,
  Building2,
  Users,
  FileText,
  X,
  Search,
  Trash2,
} from 'lucide-react';

export default function ClassManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [org, cls] = await Promise.all([
        organizationsApi.getMyOrganization(),
        classesApi.listTeaching(),
      ]);
      setOrganization(org);
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
    const state = location.state as { createClass?: boolean } | null;
    if (state?.createClass) setShowClassModal(true);
    // Clear the state so it doesn't re-trigger
    if (state) {
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDeleteClass = async () => {
    if (!deleteClassId) return;
    try {
      await classesApi.delete(deleteClassId);
      setDeleteClassId(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete class');
      setDeleteClassId(null);
    }
  };

  return (
    <DashboardLayout
      title="Class Management"
      subtitle={organization ? `${organization.name} · ${classes.length} classes` : 'Loading...'}
      headerAction={
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowClassModal(true)}
        >
          <span className="hidden sm:inline">New Class</span>
        </Button>
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
          {/* Organization Overview */}
          {organization && (
            <section className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/15 rounded-xl">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary text-lg truncate">
                    {organization.name}
                  </h3>
                  {organization.description && (
                    <p className="text-sm text-text-muted truncate">{organization.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{organization.class_count}</p>
                  <p className="text-xs text-text-muted">classes</p>
                </div>
              </div>
            </section>
          )}

          {/* Classes */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Your Classes</h2>
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
                  >
                    Create Class
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between bg-bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-lg transition-all animate-fade-in group"
                  >
                    <button
                      onClick={() => navigate(`/classes/${cls.id}`)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                          {cls.name}
                        </span>
                        {cls.is_archived && <Badge variant="warning">Archived</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {cls.student_count} students
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {cls.exam_count} exams
                        </span>
                        <span>{new Date(cls.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteClassId(cls.id);
                      }}
                      className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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

      {/* Create Class Modal */}
      {showClassModal && (
        <CreateClassModal
          onClose={() => setShowClassModal(false)}
          onCreated={() => {
            setShowClassModal(false);
            loadData();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteClassId && (
        <ConfirmDeleteModal
          onClose={() => setDeleteClassId(null)}
          onConfirm={handleDeleteClass}
          className={classes.find((c) => c.id === deleteClassId)?.name ?? 'this class'}
        />
      )}
    </DashboardLayout>
  );
}

/* ---- Modal Components ---- */

function CreateClassModal({
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
      setError('Class name is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const data: ClassCreate = {
        name: name.trim(),
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

function ConfirmDeleteModal({
  onClose,
  onConfirm,
  className,
}: {
  onClose: () => void;
  onConfirm: () => void;
  className: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  return (
    <ModalWrapper onClose={onClose} title="Delete Class">
      <div className="space-y-4">
        <p className="text-text-secondary">
          Are you sure you want to delete <strong className="text-text-primary">{className}</strong>?
          This will permanently remove all associated exams, invitations, and enrollments.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} isLoading={isDeleting}>
            Delete
          </Button>
        </div>
      </div>
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
