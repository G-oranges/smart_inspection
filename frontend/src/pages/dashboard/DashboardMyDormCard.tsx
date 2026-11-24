import {
  ArrowRightOutlined,
  HomeOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import type { DashboardMyDormSummary } from '../../hooks/useDashboardQuery';
import { formatInspectionTime, getScoreTone } from './dashboardUtils';

interface DashboardMyDormCardProps {
  summary: DashboardMyDormSummary;
  canViewResults: boolean;
}

export default function DashboardMyDormCard({
  summary,
  canViewResults,
}: DashboardMyDormCardProps) {
  const navigate = useNavigate();
  const hasLatest =
    summary.latestScore !== null && summary.latestScore !== undefined;
  const latestTone = hasLatest
    ? getScoreTone(summary.latestScore!)
    : 'primary';

  return (
    <section className="co-glass-panel dashboard-my-dorm">
      <div className="dashboard-my-dorm__head">
        <div className="dashboard-my-dorm__title-wrap">
          <span className="dashboard-my-dorm__icon">
            <HomeOutlined />
          </span>
          <div>
            <div className="dashboard-my-dorm__name">{summary.dormName}</div>
            {summary.latestTime ? (
              <div className="dashboard-my-dorm__time">
                最近检查 {formatInspectionTime(summary.latestTime)}
              </div>
            ) : null}
          </div>
        </div>

        {summary.hasActiveTask ? (
          <span className="dashboard-my-dorm__pill">
            <ScheduleOutlined />
            <span>查寝进行中</span>
          </span>
        ) : null}
      </div>

      <div className="dashboard-my-dorm__metrics">
        <div className="dashboard-my-dorm__metric">
          <span className="dashboard-my-dorm__metric-label">最近得分</span>
          <span
            className="dashboard-my-dorm__metric-val"
            data-tone={latestTone}
          >
            {hasLatest ? `${summary.latestScore} 分` : '--'}
          </span>
        </div>
        <div className="dashboard-my-dorm__metric">
          <span className="dashboard-my-dorm__metric-label">历史均分</span>
          <span className="dashboard-my-dorm__metric-val">
            {summary.avgScore !== null && summary.avgScore !== undefined
              ? `${summary.avgScore.toFixed(1)} 分`
              : '--'}
          </span>
        </div>
        <div className="dashboard-my-dorm__metric">
          <span className="dashboard-my-dorm__metric-label">待处理申诉</span>
          <span
            className="dashboard-my-dorm__metric-val"
            data-tone={summary.myPendingAppeals > 0 ? 'error' : 'primary'}
          >
            {summary.myPendingAppeals}
          </span>
        </div>
      </div>

      {canViewResults ? (
        <button
          type="button"
          onClick={() => navigate('/results')}
          className="apple-btn-secondary dashboard-my-dorm__cta co-press"
        >
          <span>查看查寝成绩</span>
          <ArrowRightOutlined />
        </button>
      ) : null}
    </section>
  );
}
