import type { ProfileCandidate } from "@shared/types/run";

type ProfileSelectPageProps = {
  profiles: ProfileCandidate[];
  onSelect: (profile: ProfileCandidate) => void;
  loading: boolean;
  selectedProfileId: string | null;
};

export const ProfileSelectPage = ({
  profiles,
  onSelect,
  loading,
  selectedProfileId
}: ProfileSelectPageProps) => (
  <section className="page">
    <div className="profile-list">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          className={`profile-item ${selectedProfileId === profile.id ? "profile-item-selected" : ""}`}
          onClick={() => onSelect(profile)}
          disabled={loading}
        >
          <strong className="profile-item-title">{profile.displayName}</strong>
          <span className="profile-item-count">{profile.runFileCount} Runs</span>
          {/* <small>{profile.steamPath}</small> */}
        </button>
      ))}
      {profiles.length === 0 && <p>No profile run data found in Steam folders.</p>}
    </div>
  </section>
);
