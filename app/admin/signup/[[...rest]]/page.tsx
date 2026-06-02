import { redirect } from 'next/navigation'

// This Clerk instance uses the combined flow: account creation happens inside
// the <SignIn> component on /admin/login (entering an unknown email transitions
// to sign-up inline). A standalone <SignUp> here just redirects back into
// <SignIn>, so we send everyone straight to the working combined flow.
export default function AdminSignupRedirect() {
  redirect('/admin/login')
}
