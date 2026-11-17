import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type RouteComponent = ComponentType<object>;
type RouteModule<T extends RouteComponent> = { default: T };
type RouteImporter<T extends RouteComponent> = () => Promise<RouteModule<T>>;
type PreloadableImporter<T extends RouteComponent> = RouteImporter<T> & {
  preload: RouteImporter<T>;
};

interface RouteMatcher {
  exact?: string;
  prefix?: string;
  loaders: Array<PreloadableImporter<RouteComponent>>;
}

type RoleCode = string | null | undefined;
type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};

function createPreloadableImporter<T extends RouteComponent>(
  importer: RouteImporter<T>,
): PreloadableImporter<T> {
  let pending: Promise<RouteModule<T>> | null = null;

  const load = (() => {
    pending ??= importer();
    return pending;
  }) as PreloadableImporter<T>;

  load.preload = () => {
    pending ??= importer();
    return pending;
  };

  return load;
}

function createLazyRoute<T extends RouteComponent>(
  importer: PreloadableImporter<T>,
): LazyExoticComponent<T> {
  return lazy(importer);
}

const dashboardImporter = createPreloadableImporter(
  () => import('../pages/DashboardPage'),
);
const dormManagementImporter = createPreloadableImporter(
  () => import('../pages/DormManagementPage'),
);
const studentManagementImporter = createPreloadableImporter(
  () => import('../pages/StudentManagementPage'),
);
const teacherManagementImporter = createPreloadableImporter(
  () => import('../pages/TeacherManagementPage'),
);
const occupancyManagementImporter = createPreloadableImporter(
  () => import('../pages/OccupancyManagementPage'),
);
const taskPublishImporter = createPreloadableImporter(
  () => import('../pages/TaskPublishPage'),
);
const resultEntryImporter = createPreloadableImporter(
  () => import('../pages/ResultEntryPage'),
);
const resultViewImporter = createPreloadableImporter(
  () => import('../pages/ResultViewPage'),
);
const accountPermissionImporter = createPreloadableImporter(
  () => import('../pages/AccountPermissionPage'),
);
const adminSettingsImporter = createPreloadableImporter(
  () => import('../pages/AdminSettingsPage'),
);
const buildingSelectImporter = createPreloadableImporter(
  () => import('../pages/BuildingSelectPage'),
);
const floorSelectImporter = createPreloadableImporter(
  () => import('../pages/FloorSelectPage'),
);
const roomSelectImporter = createPreloadableImporter(
  () => import('../pages/RoomSelectPage'),
);
const auditLogImporter = createPreloadableImporter(
  () => import('../pages/AuditLogPage'),
);
const buildingManagementImporter = createPreloadableImporter(
  () => import('../pages/BuildingManagementPage'),
);

export const DashboardPage = createLazyRoute(dashboardImporter);
export const DormManagementPage = createLazyRoute(dormManagementImporter);
export const StudentManagementPage = createLazyRoute(studentManagementImporter);
export const TeacherManagementPage = createLazyRoute(teacherManagementImporter);
export const OccupancyManagementPage = createLazyRoute(
  occupancyManagementImporter,
);
export const TaskPublishPage = createLazyRoute(taskPublishImporter);
export const ResultEntryPage = createLazyRoute(resultEntryImporter);
export const ResultViewPage = createLazyRoute(resultViewImporter);
export const AccountPermissionPage = createLazyRoute(accountPermissionImporter);
export const AdminSettingsPage = createLazyRoute(adminSettingsImporter);
export const BuildingSelectPage = createLazyRoute(buildingSelectImporter);
export const FloorSelectPage = createLazyRoute(floorSelectImporter);
export const RoomSelectPage = createLazyRoute(roomSelectImporter);
export const AuditLogPage = createLazyRoute(auditLogImporter);
export const BuildingManagementPage = createLazyRoute(
  buildingManagementImporter,
);

const ROUTE_MATCHERS: RouteMatcher[] = [
  { exact: '/dashboard', loaders: [dashboardImporter] },
  { exact: '/dorms', loaders: [dormManagementImporter] },
  { exact: '/students', loaders: [studentManagementImporter] },
  { exact: '/teachers', loaders: [teacherManagementImporter] },
  { exact: '/occupancy', loaders: [occupancyManagementImporter] },
  { exact: '/tasks/publish', loaders: [taskPublishImporter] },
  {
    prefix: '/tasks/entry',
    loaders: [
      buildingSelectImporter,
      floorSelectImporter,
      roomSelectImporter,
      resultEntryImporter,
    ],
  },
  { exact: '/results', loaders: [resultViewImporter] },
  { exact: '/accounts', loaders: [accountPermissionImporter] },
  { exact: '/settings', loaders: [adminSettingsImporter] },
  { exact: '/buildings', loaders: [buildingManagementImporter] },
  { exact: '/audit-logs', loaders: [auditLogImporter] },
];

function findRouteLoaders(pathname: string) {
  const normalizedPath = pathname.split('?')[0].split('#')[0];
  const matched = ROUTE_MATCHERS.find(({ exact, prefix }) => {
    if (exact) {
      return normalizedPath === exact;
    }

    return prefix ? normalizedPath.startsWith(prefix) : false;
  });

  return matched?.loaders ?? [];
}

function canPrefetchRoutes() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  const connection = (
    navigator as Navigator & {
      connection?: ConnectionLike;
      mozConnection?: ConnectionLike;
      webkitConnection?: ConnectionLike;
    }
  ).connection
    ?? (
      navigator as Navigator & {
        mozConnection?: ConnectionLike;
      }
    ).mozConnection
    ?? (
      navigator as Navigator & {
        webkitConnection?: ConnectionLike;
      }
    ).webkitConnection;

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  return !['slow-2g', '2g'].includes(connection.effectiveType || '');
}

export function prefetchRoute(pathname: string) {
  if (!canPrefetchRoutes()) {
    return Promise.resolve([]);
  }

  const loaders = findRouteLoaders(pathname);
  if (loaders.length === 0) {
    return Promise.resolve([]);
  }

  return Promise.all(loaders.map((loader) => loader.preload()));
}

export function getLikelyPrefetchPaths(roleCode: RoleCode) {
  switch (roleCode) {
    case 'ADMIN':
      return ['/dashboard', '/tasks/publish', '/results', '/accounts', '/settings'];
    case 'COUNSELOR':
      return ['/dashboard', '/students', '/occupancy', '/results', '/tasks/publish'];
    case 'TEACHER':
      return ['/dashboard', '/teachers', '/results', '/tasks/entry/buildings'];
    case 'STUDENT':
      return ['/dashboard', '/results'];
    case 'LEADER':
      return ['/dashboard', '/results', '/audit-logs'];
    default:
      return ['/dashboard', '/results'];
  }
}

function runWhenIdle(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(() => {
      callback();
    }, { timeout: 1200 });

    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = setTimeout(callback, 250);
  return () => clearTimeout(timeoutId);
}

export function scheduleRoutePrefetch(pathnames: string[]) {
  if (!canPrefetchRoutes()) {
    return () => {};
  }

  const uniquePaths = [...new Set(pathnames.filter(Boolean))];
  if (uniquePaths.length === 0) {
    return () => {};
  }

  return runWhenIdle(() => {
    uniquePaths.forEach((pathname) => {
      void prefetchRoute(pathname);
    });
  });
}
