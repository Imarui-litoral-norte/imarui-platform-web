"use client";
import { useCallback } from "react";
import Link from "next/link";
import { nameOf } from "../model/management";
import { useRemote } from "./useManagement";
import { CopyValue } from "./ManagementUi";
import s from "./iam.module.css";

// Only mounted for visible rows (10 locally paginated records, 20 on server pages).
// A restricted identity lookup never prevents reading the audit/policy record itself.
export default function IdentityReference({ api, id }) {
  const query = useRemote(
    useCallback(
      () => (id ? api.identity(id) : Promise.resolve(null)),
      [api, id],
    ),
  );
  if (!id) return <span>—</span>;
  return (
    <div>
      <Link
        className={s.identityLink}
        href={`/iam/identidade?identityId=${encodeURIComponent(id)}`}
      >
        {query.data ? nameOf(query.data) : "Abrir cadastro"}
      </Link>
      {query.data?.primaryEmail ? (
        <small className={s.identityEmail}>{query.data.primaryEmail}</small>
      ) : null}
      <CopyValue value={id} />
    </div>
  );
}
