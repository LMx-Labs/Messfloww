import { RouterProvider } from "react-router"
import { router } from "./core/layout/routes"

export default function App() {
  return <RouterProvider router={router} />
}
