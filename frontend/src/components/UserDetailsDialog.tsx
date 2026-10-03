import { XCircle } from "lucide-react";
import { statusMeta, StatusChip } from "./userStatus";
import { formatDate } from "@/lib/quests";
import type { UserListItem } from "@/lib/types";

interface UserDetailsDialogProps {
  item: UserListItem | null;
  onClose: () => void;
}

export function UserDetailsDialog({ item, onClose }: UserDetailsDialogProps) {
  if (!item) return null;
  const prof = item.teacherProfile ?? item.studentProfile;
  const school = prof?.school;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {item.firstName} {item.lastName}
            </h3>
            <p className="text-sm text-muted-foreground">{item.email}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
            <XCircle className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium capitalize">{item.role.toLowerCase()}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusChip status={item.status} />
          </dd>
          <dt className="text-muted-foreground">Registered</dt>
          <dd className="font-medium">{formatDate(item.createdAt)}</dd>
          {school && (
            <>
              <dt className="text-muted-foreground">Institution</dt>
              <dd className="font-medium">{school.name}</dd>
            </>
          )}
          {prof?.department && (
            <>
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium">{prof.department}</dd>
            </>
          )}
          {item.teacherProfile?.employeeId && (
            <>
              <dt className="text-muted-foreground">Employee ID</dt>
              <dd className="font-medium">{item.teacherProfile.employeeId}</dd>
            </>
          )}
          {item.studentProfile?.usn && (
            <>
              <dt className="text-muted-foreground">USN</dt>
              <dd className="font-medium">{item.studentProfile.usn}</dd>
            </>
          )}
          {item.studentProfile?.semester && (
            <>
              <dt className="text-muted-foreground">Semester</dt>
              <dd className="font-medium">{item.studentProfile.semester}</dd>
            </>
          )}
          {prof?.phone && (
            <>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{prof.phone}</dd>
            </>
          )}
          {item.rejectionReason && (
            <>
              <dt className="text-muted-foreground">Rejection reason</dt>
              <dd className="text-destructive">{item.rejectionReason}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

export { statusMeta };
