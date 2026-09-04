"use client";

import { useState } from "react";

type Client = { id: string; name: string };
type Project = { id: string; name: string; clientCompanyId: string };

export function QuoteClientProjectFields({ clients, projects }: { clients: Client[]; projects: Project[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const clientProjects = projects.filter((project) => project.clientCompanyId === clientId);

  return (
    <>
      <label>
        고객사
        <select name="clientId" onChange={(event) => setClientId(event.target.value)} required value={clientId}>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        프로젝트 (선택)
        <select defaultValue="" name="projectId">
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
