import { RouterProvider } from "react-router";
import { router } from "./layout/routes";

export default function App() {
  return <RouterProvider router={router} />;
}