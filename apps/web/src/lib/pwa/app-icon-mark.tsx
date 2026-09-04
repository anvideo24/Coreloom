import type { CSSProperties, ReactElement } from "react";

export function CoreloomAppMark({ fontSize }: { fontSize: number }): ReactElement {
  const mark: CSSProperties = {
    alignItems: "center",
    background: "#1c1916",
    color: "#e24a1b",
    display: "flex",
    fontSize,
    fontWeight: 800,
    height: "100%",
    justifyContent: "center",
    letterSpacing: "-0.06em",
    width: "100%",
  };
  return <div style={mark}>C</div>;
}
