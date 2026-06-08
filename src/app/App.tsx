import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "../components/layout/AppShell"
import { CalendarPage } from "../features/calendar/components/CalendarPage"
import { CountdownPage } from "../features/countdown/components/CountdownPage"
import { NotesPage } from "../features/notes/components/NotesPage"
import { PomodoroPage } from "../features/pomodoro/components/PomodoroPage"
import { ProfilePage } from "../features/profile/components/ProfilePage"
import { RemindersPage } from "../features/reminders/components/RemindersPage"
import { TaskListPage } from "../features/tasks/components/TaskListPage"

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/tasks" />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/countdown" element={<CountdownPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/pomodoro" element={<PomodoroPage />} />
        <Route path="*" element={<Navigate replace to="/tasks" />} />
      </Route>
    </Routes>
  )
}
