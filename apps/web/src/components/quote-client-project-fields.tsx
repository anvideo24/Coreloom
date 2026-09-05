"use client";

import { useState } from "react";

type Client = { id: string; name: string };
type Project = { id: string; name: string; clientCompanyId: string };

export function QuoteClientProjectFields({
  clients,
  projects,
  clientId: controlledClientId,
  onClientIdChange,
  onRequestNewClient,
}: {
  clients: Client[];
  projects: Project[];
  clientId?: string;
  onClientIdChange?: (clientId: string) => void;
  /** 견적 패널 안에서 고객사를 새로 등록할 때(F01-02). */
  onRequestNewClient?: () => void;
}) {
  const [localClientId, setLocalClientId] = useState(clients[0]?.id ?? "");
  const clientId = controlledClientId ?? localClientId;
  const setClientId = onClientIdChange ?? setLocalClientId;
  const clientProjects = projects.filter((project) => project.clientCompanyId === clientId);

  return (
    <>
      <label>
        고객사
        <select
          name="clientId"
          onChange={(event) => setClientId(event.target.value)}
          required
          value={clientId}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      {onRequestNewClient ? (
        <p className="form-help quote-form-full">
          <button className="text-link" onClick={onRequestNewClient} type="button">
            새 고객사 등록
          </button>
          — 견적 화면을 떠나지 않고 등록합니다.
        </p>
      ) : null}
      <label>
        프로젝트 (선택)
        <select defaultValue="" key={clientId} name="projectId">
          <option value="">연결하지 않음</option>
          {clientProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
