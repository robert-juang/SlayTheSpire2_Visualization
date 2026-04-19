type MetricCardProps = {
  label: string;
  value: string;
};

export const MetricCard = ({ label, value }: MetricCardProps) => (
  <div className="metric-card">
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
  </div>
);
