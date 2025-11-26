import Login from "../pages/Auth/Login/Login";
import SignUp from "../pages/Auth/SignUp/SignUp";
import ForgotPassword from "../pages/Auth/ForgotPassword/ForgotPassword";
import VerifyOTP from "../pages/Auth/ForgotPassword/VerifyOTP";
import ResetPassword from "../pages/Auth/ForgotPassword/ResetPassword";
export const authRoutes = [
  { path: "/", element: <Login /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <SignUp /> },
  { path: "/forgotPassword", element: <ForgotPassword /> }, 
    { path: "/verify-otp", element: <VerifyOTP /> },
  { path: "/reset-password", element: <ResetPassword /> },
];
