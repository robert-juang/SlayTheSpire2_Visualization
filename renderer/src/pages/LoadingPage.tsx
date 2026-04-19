type LoadingPageProps = {
  title: string;
  progress: number;
  detail: string;
};

export const LoadingPage = ({ title, progress, detail }: LoadingPageProps) => (
  <section className="page loading-page">
    <div className="loading-icon">🗡️</div>
    <h2>{title}</h2>
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${progress}%` }} />
    </div>
    <p>{detail}</p>
  </section>
);
