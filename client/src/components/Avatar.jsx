import { avatarFullUrl } from "../auth.js";

const HUES = [350, 20, 45, 160, 200, 260, 300];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${HUES[Math.abs(hash) % HUES.length]}, 70%, 55%)`;
}

export default function Avatar({ name, avatarUrl, size = 28 }) {
  const style = { width: size, height: size, fontSize: size * 0.5 };

  if (avatarUrl) {
    return (
      <img
        className="avatar"
        style={style}
        src={avatarFullUrl(avatarUrl)}
        alt={name}
      />
    );
  }

  return (
    <span className="avatar" style={{ ...style, background: colorFor(name || "?") }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
