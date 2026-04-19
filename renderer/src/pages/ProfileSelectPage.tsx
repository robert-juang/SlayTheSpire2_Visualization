import type { ProfileCandidate } from "@shared/types/run";

type ProfileSelectPageProps = {
  profiles: ProfileCandidate[];
  onSelect: (profile: ProfileCandidate) => void;
  loading: boolean;
};

export const ProfileSelectPage = ({
  profiles,
  onSelect,
  loading
}: ProfileSelectPageProps) => (
  <section className="page">
    <h2>Select Profile</h2>
    <p>Detected profiles for this macOS user. Pick one to load run data.</p>
    <div className="profile-list">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          className="profile-item"
          onClick={() => onSelect(profile)}
          disabled={loading}
        >
          <strong>{profile.displayName}</strong>
          <span>{profile.runFileCount} .run files</span>
          <small>{profile.steamPath}</small>
        </button>
      ))}
      {profiles.length === 0 && <p>No profile run data found in Steam folders.</p>}
    </div>
  </section>
);
