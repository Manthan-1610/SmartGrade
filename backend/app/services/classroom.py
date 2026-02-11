"""
Service layer for class management, invitations, and enrollments.

Handles class CRUD, student invitations, enrollment lifecycle,
and related business logic.
"""
import uuid
from datetime import datetime
from typing import List, Optional
import logging

from sqlmodel import Session, select, func
from sqlalchemy import and_

from ..models import (
    Class,
    ClassInvitation,
    ClassEnrollment,
    InvitationStatus,
    EnrollmentStatus,
    Organization,
    OrganizationMember,
    User,
    UserRole,
    Exam,
)
from ..schemas.classroom import (
    ClassCreate,
    ClassUpdate,
    ClassResponse,
    ClassDetailResponse,
    InvitationResponse,
    EnrollmentResponse,
)
from ..exceptions import (
    NotFoundException,
    AuthorizationException,
    ValidationException,
)
from .organization import verify_org_teacher

logger = logging.getLogger(__name__)


# ============ Class CRUD ============

def create_class(
    data: ClassCreate,
    teacher: User,
    session: Session,
) -> ClassResponse:
    """
    Create a new class within an organization.
    
    Args:
        data: Class creation data.
        teacher: The teacher creating the class.
        session: Database session.
        
    Returns:
        Created class response.
    """
    # Verify the teacher belongs to the organization
    verify_org_teacher(data.organization_id, teacher, session)

    new_class = Class(
        organization_id=data.organization_id,
        name=data.name,
        description=data.description,
        teacher_id=teacher.id,
    )
    session.add(new_class)
    session.flush()
    session.refresh(new_class)

    org = session.get(Organization, data.organization_id)
    logger.info(f"Class '{new_class.name}' created in org '{org.name}' by teacher {teacher.id}")

    return _class_to_response(new_class, session)


def get_class(
    class_id: uuid.UUID,
    session: Session,
) -> Class:
    """Get a class by ID."""
    cls = session.get(Class, class_id)
    if not cls:
        raise NotFoundException(f"Class {class_id} not found")
    return cls


def get_class_detail(
    class_id: uuid.UUID,
    user: User,
    session: Session,
) -> ClassDetailResponse:
    """Get detailed class info with students and counts."""
    cls = get_class(class_id, session)
    _verify_class_access(cls, user, session)

    # Get enrollments
    enrollments = session.exec(
        select(ClassEnrollment, User)
        .join(User, ClassEnrollment.student_id == User.id)
        .where(ClassEnrollment.class_id == class_id)
        .order_by(ClassEnrollment.enrolled_at)
    ).all()

    enrollment_responses = [
        EnrollmentResponse(
            id=e.id,
            class_id=e.class_id,
            student_id=e.student_id,
            student_name=u.name,
            student_email=u.email,
            status=e.status,
            enrolled_at=e.enrolled_at,
            archived_at=e.archived_at,
        )
        for e, u in enrollments
    ]

    # Count pending invitations
    pending_count = session.exec(
        select(func.count(ClassInvitation.id))
        .where(
            and_(
                ClassInvitation.class_id == class_id,
                ClassInvitation.status == InvitationStatus.PENDING.value,
            )
        )
    ).one()

    # Count exams
    exam_count = session.exec(
        select(func.count(Exam.id))
        .where(Exam.class_id == class_id)
    ).one()

    org = session.get(Organization, cls.organization_id)
    teacher = session.get(User, cls.teacher_id)

    return ClassDetailResponse(
        id=cls.id,
        name=cls.name,
        description=cls.description,
        organization_id=cls.organization_id,
        organization_name=org.name if org else None,
        teacher_id=cls.teacher_id,
        teacher_name=teacher.name if teacher else None,
        is_archived=cls.is_archived,
        created_at=cls.created_at,
        updated_at=cls.updated_at,
        student_count=len([e for e, _ in enrollments if e.status == EnrollmentStatus.ACTIVE.value]),
        exam_count=exam_count,
        students=enrollment_responses,
        pending_invitations=pending_count,
    )


def get_teacher_classes(
    teacher: User,
    org_id: Optional[uuid.UUID],
    session: Session,
) -> List[ClassResponse]:
    """Get classes taught by a teacher, optionally filtered by organization."""
    stmt = select(Class).where(
        and_(
            Class.teacher_id == teacher.id,
            Class.is_archived == False,
        )
    )
    if org_id:
        stmt = stmt.where(Class.organization_id == org_id)
    stmt = stmt.order_by(Class.created_at.desc())

    classes = session.exec(stmt).all()
    return [_class_to_response(c, session) for c in classes]


def get_student_classes(
    student: User,
    session: Session,
) -> List[ClassResponse]:
    """Get all classes a student is enrolled in (active enrollments only)."""
    stmt = (
        select(Class)
        .join(ClassEnrollment, Class.id == ClassEnrollment.class_id)
        .where(
            and_(
                ClassEnrollment.student_id == student.id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
                Class.is_archived == False,
            )
        )
        .order_by(Class.created_at.desc())
    )
    classes = session.exec(stmt).all()
    return [_class_to_response(c, session) for c in classes]


def update_class(
    class_id: uuid.UUID,
    data: ClassUpdate,
    teacher: User,
    session: Session,
) -> ClassResponse:
    """Update a class. Only the class teacher or org owner can update."""
    cls = get_class(class_id, session)
    _verify_class_teacher(cls, teacher, session)

    if data.name is not None:
        cls.name = data.name
    if data.description is not None:
        cls.description = data.description
    cls.updated_at = datetime.utcnow()

    session.add(cls)
    session.flush()
    session.refresh(cls)
    return _class_to_response(cls, session)


def archive_class(
    class_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> ClassResponse:
    """Archive a class (soft delete)."""
    cls = get_class(class_id, session)
    _verify_class_teacher(cls, teacher, session)

    cls.is_archived = True
    cls.updated_at = datetime.utcnow()
    session.add(cls)
    session.flush()
    session.refresh(cls)
    logger.info(f"Class '{cls.name}' archived by teacher {teacher.id}")
    return _class_to_response(cls, session)


# ============ Invitations ============

def invite_student(
    class_id: uuid.UUID,
    student_email: str,
    teacher: User,
    session: Session,
) -> InvitationResponse:
    """
    Invite a student to a class.
    
    Validates:
        - Teacher owns the class.
        - Student email exists and belongs to a student role.
        - Student is not already invited or enrolled.
    """
    cls = get_class(class_id, session)
    _verify_class_teacher(cls, teacher, session)

    # Find the student
    student = session.exec(
        select(User).where(User.email == student_email)
    ).first()
    if not student:
        raise NotFoundException(f"No user found with email '{student_email}'")
    if student.role != UserRole.STUDENT.value:
        raise ValidationException(f"User '{student_email}' is not registered as a student")

    # Check existing enrollment
    existing_enrollment = session.exec(
        select(ClassEnrollment).where(
            and_(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.student_id == student.id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
            )
        )
    ).first()
    if existing_enrollment:
        raise ValidationException(f"Student '{student_email}' is already enrolled in this class")

    # Check existing pending invitation
    existing_invitation = session.exec(
        select(ClassInvitation).where(
            and_(
                ClassInvitation.class_id == class_id,
                ClassInvitation.student_id == student.id,
                ClassInvitation.status == InvitationStatus.PENDING.value,
            )
        )
    ).first()
    if existing_invitation:
        raise ValidationException(f"Student '{student_email}' already has a pending invitation")

    invitation = ClassInvitation(
        class_id=class_id,
        student_id=student.id,
        invited_by=teacher.id,
    )
    session.add(invitation)
    session.flush()
    session.refresh(invitation)

    org = session.get(Organization, cls.organization_id)
    logger.info(
        f"Invitation sent to student {student.id} for class '{cls.name}' by teacher {teacher.id}"
    )

    return InvitationResponse(
        id=invitation.id,
        class_id=cls.id,
        class_name=cls.name,
        organization_name=org.name if org else None,
        student_id=student.id,
        student_name=student.name,
        student_email=student.email,
        invited_by=teacher.id,
        invited_by_name=teacher.name,
        status=invitation.status,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
    )


def get_class_invitations(
    class_id: uuid.UUID,
    teacher: User,
    session: Session,
    status_filter: Optional[str] = None,
) -> List[InvitationResponse]:
    """Get all invitations for a class (teacher view)."""
    cls = get_class(class_id, session)
    _verify_class_teacher(cls, teacher, session)

    stmt = (
        select(ClassInvitation, User)
        .join(User, ClassInvitation.student_id == User.id)
        .where(ClassInvitation.class_id == class_id)
    )
    if status_filter:
        stmt = stmt.where(ClassInvitation.status == status_filter)
    stmt = stmt.order_by(ClassInvitation.created_at.desc())

    results = session.exec(stmt).all()
    org = session.get(Organization, cls.organization_id)

    return [
        InvitationResponse(
            id=inv.id,
            class_id=inv.class_id,
            class_name=cls.name,
            organization_name=org.name if org else None,
            student_id=inv.student_id,
            student_name=student.name,
            student_email=student.email,
            invited_by=inv.invited_by,
            invited_by_name=teacher.name,
            status=inv.status,
            created_at=inv.created_at,
            responded_at=inv.responded_at,
        )
        for inv, student in results
    ]


def get_student_invitations(
    student: User,
    session: Session,
    status_filter: Optional[str] = None,
) -> List[InvitationResponse]:
    """Get all invitations received by a student."""
    stmt = (
        select(ClassInvitation, Class, Organization)
        .join(Class, ClassInvitation.class_id == Class.id)
        .join(Organization, Class.organization_id == Organization.id)
        .where(ClassInvitation.student_id == student.id)
    )
    if status_filter:
        stmt = stmt.where(ClassInvitation.status == status_filter)
    stmt = stmt.order_by(ClassInvitation.created_at.desc())

    results = session.exec(stmt).all()

    invitations = []
    for inv, cls, org in results:
        invited_by_user = session.get(User, inv.invited_by)
        invitations.append(InvitationResponse(
            id=inv.id,
            class_id=inv.class_id,
            class_name=cls.name,
            organization_name=org.name,
            student_id=student.id,
            student_name=student.name,
            student_email=student.email,
            invited_by=inv.invited_by,
            invited_by_name=invited_by_user.name if invited_by_user else None,
            status=inv.status,
            created_at=inv.created_at,
            responded_at=inv.responded_at,
        ))

    return invitations


def respond_to_invitation(
    invitation_id: uuid.UUID,
    action: str,
    student: User,
    session: Session,
) -> InvitationResponse:
    """
    Accept or reject an invitation.
    
    On accept, creates a ClassEnrollment record.
    """
    invitation = session.get(ClassInvitation, invitation_id)
    if not invitation:
        raise NotFoundException("Invitation not found")
    if invitation.student_id != student.id:
        raise AuthorizationException("This invitation is not for you")
    if invitation.status != InvitationStatus.PENDING.value:
        raise ValidationException(f"Invitation has already been {invitation.status}")

    invitation.status = (
        InvitationStatus.ACCEPTED.value if action == "accept"
        else InvitationStatus.REJECTED.value
    )
    invitation.responded_at = datetime.utcnow()
    session.add(invitation)

    # On accept, create enrollment
    if action == "accept":
        enrollment = ClassEnrollment(
            class_id=invitation.class_id,
            student_id=student.id,
        )
        session.add(enrollment)

    session.flush()
    session.refresh(invitation)

    cls = session.get(Class, invitation.class_id)
    org = session.get(Organization, cls.organization_id) if cls else None
    invited_by_user = session.get(User, invitation.invited_by)

    logger.info(
        f"Student {student.id} {action}ed invitation {invitation_id} "
        f"for class '{cls.name if cls else 'unknown'}'"
    )

    return InvitationResponse(
        id=invitation.id,
        class_id=invitation.class_id,
        class_name=cls.name if cls else None,
        organization_name=org.name if org else None,
        student_id=student.id,
        student_name=student.name,
        student_email=student.email,
        invited_by=invitation.invited_by,
        invited_by_name=invited_by_user.name if invited_by_user else None,
        status=invitation.status,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
    )


# ============ Enrollment Management ============

def update_enrollment_status(
    enrollment_id: uuid.UUID,
    new_status: str,
    teacher: User,
    session: Session,
) -> EnrollmentResponse:
    """Update enrollment status (e.g., archive a student)."""
    enrollment = session.get(ClassEnrollment, enrollment_id)
    if not enrollment:
        raise NotFoundException("Enrollment not found")

    cls = get_class(enrollment.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    enrollment.status = new_status
    if new_status == EnrollmentStatus.ARCHIVED.value:
        enrollment.archived_at = datetime.utcnow()
    session.add(enrollment)
    session.flush()
    session.refresh(enrollment)

    student = session.get(User, enrollment.student_id)
    return EnrollmentResponse(
        id=enrollment.id,
        class_id=enrollment.class_id,
        student_id=enrollment.student_id,
        student_name=student.name if student else None,
        student_email=student.email if student else None,
        status=enrollment.status,
        enrolled_at=enrollment.enrolled_at,
        archived_at=enrollment.archived_at,
    )


def remove_enrollment(
    enrollment_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> None:
    """Remove a student from a class entirely."""
    enrollment = session.get(ClassEnrollment, enrollment_id)
    if not enrollment:
        raise NotFoundException("Enrollment not found")

    cls = get_class(enrollment.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    session.delete(enrollment)
    session.flush()
    logger.info(f"Student {enrollment.student_id} removed from class {enrollment.class_id}")


def verify_student_enrolled(class_id: uuid.UUID, student_id: uuid.UUID, session: Session) -> bool:
    """Verify a student is actively enrolled in a class. Public helper."""
    enrollment = session.exec(
        select(ClassEnrollment).where(
            and_(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.student_id == student_id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
            )
        )
    ).first()
    return enrollment is not None


# ============ Helpers ============

def _class_to_response(cls: Class, session: Session) -> ClassResponse:
    """Convert a Class model to ClassResponse with counts."""
    org = session.get(Organization, cls.organization_id)
    teacher = session.get(User, cls.teacher_id)

    student_count = session.exec(
        select(func.count(ClassEnrollment.id))
        .where(
            and_(
                ClassEnrollment.class_id == cls.id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
            )
        )
    ).one()

    exam_count = session.exec(
        select(func.count(Exam.id))
        .where(Exam.class_id == cls.id)
    ).one()

    return ClassResponse(
        id=cls.id,
        name=cls.name,
        description=cls.description,
        organization_id=cls.organization_id,
        organization_name=org.name if org else None,
        teacher_id=cls.teacher_id,
        teacher_name=teacher.name if teacher else None,
        is_archived=cls.is_archived,
        created_at=cls.created_at,
        updated_at=cls.updated_at,
        student_count=student_count,
        exam_count=exam_count,
    )


def _verify_class_teacher(cls: Class, user: User, session: Session) -> None:
    """Verify user is the class teacher or org owner."""
    if cls.teacher_id == user.id:
        return
    # Also allow org owner
    org = session.get(Organization, cls.organization_id)
    if org and org.owner_id == user.id:
        return
    raise AuthorizationException("You don't have permission to manage this class")


def _verify_class_access(cls: Class, user: User, session: Session) -> None:
    """Verify user has access to view a class (teacher, org member, or enrolled student)."""
    # Teacher or org owner
    if cls.teacher_id == user.id:
        return
    org = session.get(Organization, cls.organization_id)
    if org and org.owner_id == user.id:
        return
    # Org member
    member = session.exec(
        select(OrganizationMember).where(
            and_(
                OrganizationMember.organization_id == cls.organization_id,
                OrganizationMember.user_id == user.id,
            )
        )
    ).first()
    if member:
        return
    # Enrolled student
    if verify_student_enrolled(cls.id, user.id, session):
        return
    raise AuthorizationException("You don't have access to this class")
