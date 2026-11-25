import type { Dispatch, PropsWithChildren, SetStateAction } from 'react';
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import AppLayout from './layouts/AppLayout';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import { AppContext, useAppContext } from './context/AppContext';
import PWAUpdatePrompt from './components/common/PWAUpdatePrompt';
import { NetworkStatusIndicator } from './components/common/NetworkStatusIndicator';
import { useAuth } from './hooks/useAuth';
import { useDorms } from './hooks/useDorms';
import { useStudents } from './hooks/useStudents';
import { useTeachers } from './hooks/useTeachers';
import { useTasks } from './hooks/useTasks';
import { useUsers } from './hooks/useUsers';
import { useSettings } from './hooks/useSettings';
import useThemeCustomization from './hooks/useThemeCustomization';
import { commonService } from './services/commonService';
import { dormService } from './services/dormService';
import { tableConfigService } from './services/tableConfigService';
import { getThemeConfig } from './theme/antdTheme';
import { useMobile } from './hooks/useMobile';
import type { UseAuthResult } from './hooks/useAuth';
import {
  AccountPermissionPage,
  AdminSettingsPage,
  AppealManagementPage,
  AuditLogPage,
  BuildingManagementPage,
  BuildingSelectPage,
  DashboardPage,
  DormManagementPage,
  FloorSelectPage,
  getLikelyPrefetchPaths,
  OccupancyManagementPage,
  prefetchRoute,
  ResultEntryPage,
  ResultViewPage,
  RoomSelectPage,
  StudentManagementPage,
  TaskPublishPage,
  TeacherManagementPage,
} from './routes/routePrefetch';

import type {
  ActiveTheme,
  AppContextValue,
  AppSelectionState,
  ThemeCustomizationState,
  ThemeMode,
} from './types/app';
import type { QueryParams } from './types/api';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
  activeTheme: ActiveTheme;
  fontSizeScale: number;
  setFontSizeScale: Dispatch<SetStateAction<number>>;
}

interface AppProviderProps extends PropsWithChildren {
  auth: UseAuthResult;
  themeState: ThemeState;
  themeCustomization: ThemeCustomizationState;
}

const INITIAL_SELECTION_STATE: AppSelectionState = {
  count: 0,
  title: '',
  onClear: null,
  onAction: null,
  actionLabel: '操作',
};

function normalizeThemeMode(value: string | null): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value;
  }

  return 'auto';
}

function RouteLoadingFallback() {
  return (
    <div className="loading-screen">
      <p>页面加载中…</p>
    </div>
  );
}

function AppProvider({
  children,
  auth,
  themeState,
  themeCustomization,
}: AppProviderProps) {
  const {
    token,
    user,
    permissions,
    hasPermission,
    logout,
    changePassword,
    refreshUser,
    refreshPermissions,
    activeRole,
    setActiveRole,
    userRoles,
    permissionsReady,
  } = auth;

  const {
    themeMode,
    setThemeMode,
    activeTheme,
    fontSizeScale,
    setFontSizeScale,
  } = themeState;

  const {
    dorms,
    dormBeds,
    fetchDorms,
    fetchDormBeds,
    createDorm,
    deleteDorms,
    importDorms,
    previewImportDorms,
    fetchDormTable,
    exportDorms,
    downloadTemplate,
  } = useDorms(user, activeRole);

  const {
    students,
    myProfile,
    fetchStudents,
    fetchMyProfile,
    createStudent,
    updateStudent,
    deleteStudents,
    importStudents,
    previewImportStudents,
    updateMyContact,
    fetchStudentTable,
    exportStudents,
  } = useStudents(user, activeRole);

  const {
    fetchTeacherTable,
    createTeacher,
    updateTeacher,
    deleteTeachers,
    exportTeachers,
    importTeachers,
    previewImportTeachers,
  } = useTeachers();

  const {
    tasks,
    inspections,
    myInspections,
    appeals,
    myAppeals,
    fetchTasks,
    fetchInspections,
    fetchMyInspections,
    fetchAppeals,
    fetchMyAppeals,
    createTask,
    updateTask,
    deleteTask,
    deleteInspection,
    deleteInspections,
    submitScore,
    adjustScore,
    handleAppeal,
    createAppeal,
    loadInspectionRecord,
    fetchAssignedDorms,
    exportResults,
  } = useTasks(user, activeRole);

  const {
    users,
    loadUsers,
    createUser,
    updateUser,
    deleteUsers,
    resetUserPassword,
    generateTemporaryPassword,
    fetchExecutors,
    updateMe,
  } = useUsers(user, activeRole);

  const { settings, fetchSettings, updateSettings } = useSettings();
  const [selection, setSelection] = useState<AppSelectionState>(
    INITIAL_SELECTION_STATE,
  );

  const loadAll = useCallback((): void => {
    void fetchSettings();
    void refreshPermissions();
    void fetchMyProfile();
  }, [fetchMyProfile, fetchSettings, refreshPermissions]);

  useEffect(() => {
    if (token) {
      loadAll();
    }
  }, [loadAll, token]);

  const actions = useMemo<AppContextValue['actions']>(
    () => ({
      getBuildings: (params?: QueryParams) => dormService.getBuildings(params),
      getFloors: (params?: QueryParams) => dormService.getFloors(params),
      getRooms: (params?: QueryParams) => dormService.getRooms(params),
      createDorm,
      updateDorm: (id: string | number, payload: unknown) =>
        dormService.updateDorm(id, payload),
      deleteDorms,
      importDorms,
      previewImportDorms,
      fetchDormTable,
      exportDorms,
      downloadTemplate,
      createStudent,
      updateStudent,
      deleteStudents,
      importStudents,
      previewImportStudents,
      updateMyContact,
      fetchStudentTable,
      exportStudents,
      fetchMyProfile,
      fetchTeacherTable,
      createTeacher,
      updateTeacher,
      deleteTeachers,
      exportTeachers,
      importTeachers,
      previewImportTeachers,
      createTask,
      updateTask,
      deleteTask,
      deleteInspection,
      deleteInspections,
      submitScore,
      adjustScore,
      handleAppeal,
      createAppeal,
      loadInspectionRecord,
      fetchAssignedDorms,
      exportResults,
      createUser,
      updateUser,
      deleteUsers,
      resetUserPassword,
      generateTemporaryPassword,
      changePassword,
      fetchExecutors,
      updateMe,
      updateSettings,
      refreshSettings: fetchSettings,
      loadDorms: fetchDorms,
      loadDormBeds: fetchDormBeds,
      loadStudents: fetchStudents,
      loadUsers,
      loadTasks: fetchTasks,
      loadInspections: fetchInspections,
      loadAppeals: fetchAppeals,
      loadMyInspections: fetchMyInspections,
      loadMyAppeals: fetchMyAppeals,
      refreshPermissions,
      refreshUser,
      fetchRoleMatrix: () => commonService.getRoleMatrix(),
      updateRolePermissions: (
        roleId: string | number,
        permissionIds: Array<string | number>,
      ) => commonService.updateRolePermissions(roleId, permissionIds),
      fetchUserOverrides: (userId: string | number) =>
        commonService.getUserOverrides(userId),
      updateUserOverrides: (userId: string | number, overrides: unknown) =>
        commonService.updateUserOverrides(userId, overrides),
      fetchRoles: () => commonService.getRoles(),
      fetchRoleTypes: () => commonService.getRoleTypes(),
      createRole: (payload: unknown) =>
        commonService.createRole(payload as Record<string, unknown>),
      updateRole: (roleId: string | number, payload: unknown) =>
        commonService.updateRole(roleId, payload as Record<string, unknown>),
      updateRoleStatus: (roleId: string | number, status: string) =>
        commonService.updateRoleStatus(roleId, status),
      deleteRole: (roleId: string | number) => commonService.deleteRole(roleId),
      createRoleType: (payload: unknown) =>
        commonService.createRoleType(payload as Record<string, unknown>),
      updateRoleType: (roleTypeId: string | number, payload: unknown) =>
        commonService.updateRoleType(roleTypeId, payload as Record<string, unknown>),
      updateRoleTypeStatus: (roleTypeId: string | number, status: string) =>
        commonService.updateRoleTypeStatus(roleTypeId, status),
      deleteRoleType: (roleTypeId: string | number) => commonService.deleteRoleType(roleTypeId),
      fetchRoleDataScope: (roleId: string | number) =>
        commonService.getRoleDataScope(roleId),
      saveRoleDataScope: (roleId: string | number, payload: unknown) =>
        commonService.saveRoleDataScope(roleId, payload as Record<string, unknown>),
      fetchTableConfig: (tableKey: string) =>
        tableConfigService.getTableConfig(tableKey),
      saveTableConfig: (tableKey: string, config: unknown) =>
        tableConfigService.saveTableConfig(tableKey, config),
      fetchDormByLocation: (params?: QueryParams) => dormService.findDorm(params),
      fetchDormMembers: (dormId: string | number) =>
        dormService.getDormMembers(dormId),
      uploadPhoto: (file: File) => commonService.uploadPhoto(file),
      uploadAvatar: (file: File) => commonService.uploadAvatar(file),
      getDormBeds: (dormId: string | number) => dormService.getDormBeds(dormId),
      getOccupancyStats: () => dormService.getOccupancyStats(),
      assignOccupancy: (payload: unknown) => dormService.assignOccupancy(payload),
      moveBed: (payload: unknown) => dormService.moveBed(payload),
      swapBedOccupancy: (payload: unknown) =>
        dormService.swapBedOccupancy(payload),
      checkoutStudent: (studentId: string | number) =>
        dormService.checkoutStudent(studentId),
      batchUpdateUserOverrides: (
        userIds: Array<string | number>,
        overrides: unknown,
      ) => commonService.batchUpdateUserOverrides(userIds, overrides),
      batchSetMonitor: (
        studentIds: Array<string | number>,
        replaceExisting: boolean,
      ) => commonService.batchSetMonitor(studentIds, replaceExisting),
    }),
    [
      changePassword,
      createDorm,
      createAppeal,
      createStudent,
      createTask,
      createTeacher,
      createUser,
      deleteDorms,
      deleteInspection,
      deleteInspections,
      deleteStudents,
      deleteTask,
      deleteTeachers,
      deleteUsers,
      downloadTemplate,
      exportDorms,
      exportResults,
      exportStudents,
      exportTeachers,
      fetchAppeals,
      fetchAssignedDorms,
      fetchDormBeds,
      fetchDormTable,
      fetchDorms,
      fetchExecutors,
      fetchInspections,
      fetchMyInspections,
      fetchMyProfile,
      fetchMyAppeals,
      fetchSettings,
      fetchStudents,
      fetchStudentTable,
      fetchTasks,
      fetchTeacherTable,
      handleAppeal,
      importDorms,
      importStudents,
      importTeachers,
      loadInspectionRecord,
      loadUsers,
      previewImportDorms,
      previewImportStudents,
      previewImportTeachers,
      refreshPermissions,
      refreshUser,
      resetUserPassword,
      submitScore,
      generateTemporaryPassword,
      adjustScore,
      updateMe,
      updateSettings,
      updateStudent,
      updateTask,
      updateTeacher,
      updateUser,
      updateMyContact,
    ],
  );

  const contextValue: AppContextValue = {
    user,
    data: {
      dorms,
      users,
      tasks,
      inspections,
      myInspections,
      appeals,
      myAppeals,
      students,
      dormBeds,
    },
    actions,
    permissions,
    hasPermission,
    refresh: loadAll,
    refreshUser,
    onLogout: logout,
    settings,
    permissionsReady,
    myProfile: myProfile ?? null,
    activeRole,
    setActiveRole,
    userRoles,
    themeMode,
    activeTheme,
    setThemeMode,
    fontSizeScale,
    setFontSizeScale,
    selection,
    setSelection,
    themeCustomization,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

function ThemeWrapper({ children }: PropsWithChildren) {
  const { activeTheme, fontSizeScale } = useAppContext();
  const isMobile = useMobile();
  const themeConfig = getThemeConfig(activeTheme, isMobile, fontSizeScale);

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}

function App() {
  const auth = useAuth();
  const { token, user, loading, error, login, activeRole } = auth;
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    normalizeThemeMode(localStorage.getItem('themeMode')),
  );
  const themeCustomizationState = useThemeCustomization();
  const [systemTheme, setSystemTheme] = useState<ActiveTheme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [fontSizeScale, setFontSizeScale] = useState<number>(() => {
    const stored = parseFloat(localStorage.getItem('fontSizeScale') || '');
    return Number.isFinite(stored) ? stored : 1;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const activeTheme = useMemo<ActiveTheme>(
    () => (themeMode === 'auto' ? systemTheme : themeMode),
    [systemTheme, themeMode],
  );

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.setProperty('--font-scale', String(fontSizeScale));
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('fontSizeScale', String(fontSizeScale));
  }, [activeTheme, fontSizeScale, themeMode]);

  useEffect(() => {
    if (!token || !user || typeof window === 'undefined') {
      return;
    }

    const currentPath = window.location.pathname;
    const normalizedCurrentPath =
      currentPath === '/' || currentPath === '/users'
        ? '/dashboard'
        : currentPath === '/tasks/entry'
          ? '/tasks/entry/buildings'
          : currentPath;

    const warmPaths = [
      normalizedCurrentPath,
      ...getLikelyPrefetchPaths(activeRole?.code || user.role).slice(0, 3),
    ];

    [...new Set(warmPaths)].forEach((path) => {
      void prefetchRoute(path);
    });
  }, [activeRole?.code, token, user]);

  const appThemeConfig = getThemeConfig(activeTheme, false, fontSizeScale);
  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  if (loading) {
    return (
      <ConfigProvider locale={zhCN} theme={appThemeConfig}>
        <div className="loading-screen">
          <p>加载中…</p>
        </div>
      </ConfigProvider>
    );
  }

  if (!token || !user) {
    return (
      <ConfigProvider locale={zhCN} theme={appThemeConfig}>
        <AntApp>
          <main className="apple-bg-gradient min-h-screen flex items-center justify-center p-6">
            {showForgotPassword ? (
              <ForgotPasswordForm
                onBack={() => setShowForgotPassword(false)}
                theme={activeTheme}
                toggleTheme={toggleTheme}
              />
            ) : (
              <LoginForm
                onLogin={login}
                loading={loading}
                error={error}
                onForgotPassword={() => setShowForgotPassword(true)}
                theme={activeTheme}
                toggleTheme={toggleTheme}
              />
            )}
          </main>
        </AntApp>
      </ConfigProvider>
    );
  }

  return (
    <AppProvider
      auth={auth}
      themeState={{
        themeMode,
        setThemeMode,
        activeTheme,
        fontSizeScale,
        setFontSizeScale,
      }}
      themeCustomization={themeCustomizationState}
    >
      <ThemeWrapper>
        <AntApp>
          <NetworkStatusIndicator />
          <PWAUpdatePrompt />

          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dorms" element={<DormManagementPage />} />
                  <Route path="/students" element={<StudentManagementPage />} />
                  <Route
                    path="/occupancy"
                    element={<OccupancyManagementPage />}
                  />
                  <Route path="/teachers" element={<TeacherManagementPage />} />
                  <Route
                    path="/users"
                    element={<Navigate to="/accounts" replace />}
                  />
                  <Route path="/tasks/publish" element={<TaskPublishPage />} />
                  <Route
                    path="/tasks/entry"
                    element={<Navigate to="/tasks/entry/buildings" replace />}
                  />
                  <Route
                    path="/tasks/entry/buildings"
                    element={<BuildingSelectPage />}
                  />
                  <Route
                    path="/tasks/entry/buildings/:building/floors"
                    element={<FloorSelectPage />}
                  />
                  <Route
                    path="/tasks/entry/buildings/:building/floors/:floor/rooms"
                    element={<RoomSelectPage />}
                  />
                  <Route
                    path="/tasks/entry/buildings/:building/floors/:floor/rooms/:room"
                    element={<ResultEntryPage />}
                  />
                  <Route path="/results" element={<ResultViewPage />} />
                  <Route path="/appeals" element={<AppealManagementPage />} />
                  <Route path="/accounts" element={<AccountPermissionPage />} />
                  <Route path="/settings" element={<AdminSettingsPage />} />
                  <Route path="/buildings" element={<BuildingManagementPage />} />
                  <Route path="/audit-logs" element={<AuditLogPage />} />
                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AntApp>
      </ThemeWrapper>
    </AppProvider>
  );
}

export default App;


