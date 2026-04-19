import { RouterProvider } from "react-router"
import { router } from "./core/layout/routes"

// Import OrderProvider relative to this App.tsx, but will let user fix context wrappers if needed.
// This is a minimal skeleton App
export default function App() {
  return <RouterProvider router={router} />
}
