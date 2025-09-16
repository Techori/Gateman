import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LoaderCircle,
  User,
  Mail,
  Phone,
  Lock,
  UserCheck,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { AxiosError } from "axios";
import { toast, ToastContainer } from "react-toastify";
import { createEmployee, logoutUserBySessionId } from "@/http/api";
import { useDispatch } from "react-redux";
import { deleteUser, updateAccessToken } from "@/features/auth/authSlice";
import { useNavigate } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";

interface FormFields {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: "gateKeeper" | "reception";
}
interface ErrorResponse {
  message: string;
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "phoneNumber is required")
    .max(10, "10 digits phone number is required"),
  email: z.email(),
  password: z.string().trim().min(6, { message: "password is required" }),
  role: z.enum(["gateKeeper", "reception"]),
});

const CreateSaleEmployee = () => {
  const [errMsg, setErrMsg] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationKey: ["createEmployee"],
    mutationFn: createEmployee,
    onError: async (err: AxiosError<ErrorResponse>) => {
      console.log("mutation Error", err);
      const errorMeassge =
        err.response?.data.message || "Something went wrong.Try it again!";
      setErrMsg(errorMeassge);
      // toast
      // logout user if token exprie
      // Only logout user if refresh token is expired/invalid (not just access token)
      if (err.response?.status === 401) {
        console.log("err.response?.status :", err.response?.status);

        // Check if the error message indicates refresh token issues
        const errorMessage = err.response?.data?.message?.toLowerCase() || "";
        const isRefreshTokenError =
          errorMessage.includes("refresh token") ||
          errorMessage.includes("session expired") ||
          errorMessage.includes("session mismatch") ||
          errorMessage.includes("please log in again") ||
          errorMessage.includes("invalid or expired refresh token");

        // Only logout if it's a refresh token related error
        if (isRefreshTokenError) {
          const userSessionData = JSON.parse(
            sessionStorage.getItem("user") || `{}`
          );
          const id = userSessionData.id;
          const sessionId = userSessionData.sessionId;
          dispatch(deleteUser());
          sessionStorage.clear();
          await logoutUserBySessionId({ id, sessionId });
          navigate("/auth/login");
        }
      }
      toast.error(errorMeassge, { position: "top-right" });
    },
    onSuccess: (response) => {
      console.log("resp ", response);
      console.log("tokenUpdate", response.isAccessTokenExp);
      if (response.isAccessTokenExp) {
        const { accessToken, refreshToken } = response;
        if (accessToken && refreshToken) {
          // update access refresh token in   session storage
          const userSessionData = JSON.parse(
            sessionStorage.getItem("user") || `{}`
          );
          userSessionData.accessToken = accessToken;
          userSessionData.refreshToken = refreshToken;
          sessionStorage.removeItem("user");
          sessionStorage.setItem("user", JSON.stringify(userSessionData));
        }
        if (accessToken) {
          // update access  token in redux and session storage
          dispatch(updateAccessToken(accessToken));
          const userSessionData = JSON.parse(
            sessionStorage.getItem("user") || `{}`
          );
          userSessionData.accessToken = accessToken;
          sessionStorage.removeItem("user");
          sessionStorage.setItem("user", JSON.stringify(userSessionData));
        }
      }

      toast.success(response.message, { position: "top-right" });
      reset();
    },
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(schema),
  });
  const onSubmit = (data: FormFields) => {
    console.log("data", data);
    mutation.mutate(data);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Fixed Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 bg-white border-b px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-gray-300" />
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Create New Employee
            </h1>
            <p className="text-xs text-gray-600">
              Add a new team member to your organization
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-xl font-semibold text-white">
                Employee Information
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Please fill in all required fields
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              {/* Error Message */}
              {mutation.isError && errMsg && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{errMsg}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register("name")}
                      type="text"
                      placeholder="Enter full name"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        errors.name
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="Enter email address"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        errors.email
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Phone Number Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register("phoneNumber")}
                      type="tel"
                      placeholder="Enter 10-digit phone number"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        errors.phoneNumber
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    />
                  </div>
                  {errors.phoneNumber && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                      {errors.phoneNumber.message}
                    </p>
                  )}
                </div>

                {/* Role Field with Styled Options */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserCheck className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      {...register("role")}
                      className={`w-full pl-10 pr-8 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none bg-white cursor-pointer ${
                        errors.role
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        backgroundSize: "16px",
                      }}
                    >
                      <option value="" className="text-gray-400 bg-gray-50">
                        Select a role
                      </option>
                      <option
                        value="gateKeeper"
                        className="text-gray-900 bg-white hover:bg-blue-50 py-2"
                      >
                        Gate Keeper
                      </option>
                      <option
                        value="reception"
                        className="text-gray-900 bg-white hover:bg-blue-50 py-2"
                      >
                        Reception
                      </option>
                    </select>
                  </div>
                  {errors.role && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                      {errors.role.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Password Field - Full Width */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register("password")}
                    type="password"
                    placeholder="Enter secure password (min. 6 characters)"
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.password
                        ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className={`w-full py-3 px-6 rounded-lg text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
                    mutation.isPending
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] shadow-lg hover:shadow-xl"
                  }`}
                >
                  {mutation.isPending ? (
                    <>
                      <LoaderCircle className="w-5 h-5 animate-spin" />
                      Creating Employee...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5" />
                      Create Employee
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer Note */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              All fields marked with <span className="text-red-500">*</span> are
              required
            </p>
          </div>
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
  //   return (
  //     // <div>
  //     //   <div>
  //     //     <form onSubmit={handleSubmit(onSubmit)}>
  //     //       <span className="">Enter information to create an account</span>
  //     //       <br />
  //     //       {mutation.isError && (
  //     //         <span className="self-center mb-1 text-sm text-red-500">
  //     //           {errMsg}
  //     //         </span>
  //     //       )}
  //     //       <label className="mt-1">
  //     //         <span className="block text:md after:content-['*'] after:ml-0.5 after:text-red-500 font-semibold  mt-1 text-copy-secondary ">
  //     //           Name
  //     //         </span>
  //     //         <input
  //     //           className="w-full p-1 mb-1 font-medium text-black border rounded peer focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 invalid:text-red-500 invalid:focus:border-red-500 invalid:focus:ring-red-500 placeholder:text-gray-400"
  //     //           {...register("name", {
  //     //             required: "name is required",
  //     //           })}
  //     //           type="text"
  //     //           placeholder="Enter your name"
  //     //         />
  //     //       </label>
  //     //       {errors.name && (
  //     //         <span className="text-sm font-medium text-red-600">
  //     //           {" "}
  //     //           {errors.name.message}
  //     //         </span>
  //     //       )}
  //     //       <label className="mt-1">
  //     //         <span className="block text:md after:content-['*'] after:ml-0.5 after:text-red-500 font-semibold  mt-1 text-copy-secondary ">
  //     //           Email
  //     //         </span>
  //     //         <input
  //     //           className="w-full p-1 mb-1 font-medium text-black border rounded peer focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 invalid:text-red-500 invalid:focus:border-red-500 invalid:focus:ring-red-500 placeholder:text-gray-400"
  //     //           {...register("email", {
  //     //             required: "email is required",
  //     //             validate: (value) => value.includes("@"),
  //     //           })}
  //     //           type="email"
  //     //           placeholder="Enter your email"
  //     //         />
  //     //       </label>
  //     //       {errors.email && (
  //     //         <span className="text-sm font-medium text-red-600">
  //     //           {" "}
  //     //           {errors.email.message}
  //     //         </span>
  //     //       )}
  //     //       <label className="mt-1">
  //     //         <span className="block text:md after:content-['*'] after:ml-0.5 after:text-red-500 font-semibold  mt-1 text-copy-secondary ">
  //     //           Phone Number
  //     //         </span>
  //     //         <input
  //     //           className="w-full p-1 mb-1 font-medium text-black border rounded peer focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 invalid:text-red-500 invalid:focus:border-red-500 invalid:focus:ring-red-500 placeholder:text-gray-400"
  //     //           {...register("phoneNumber", {
  //     //             required: "phoneNumber is required",
  //     //           })}
  //     //           type="text"
  //     //           placeholder="Enter your phoneNumber"
  //     //         />
  //     //       </label>
  //     //       {errors.phoneNumber && (
  //     //         <span className="text-sm font-medium text-red-600">
  //     //           {" "}
  //     //           {errors.phoneNumber.message}
  //     //         </span>
  //     //       )}
  //     //       <label>
  //     //         <span>Role</span>
  //     //         <select
  //     //           className="w-full p-1 mb-1 font-medium text-black border rounded peer focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 invalid:text-red-500 invalid:focus:border-red-500 invalid:focus:ring-red-500 placeholder:text-gray-400"
  //     //           {...register("role", {
  //     //             required: "Role is required",
  //     //           })}
  //     //         >
  //     //           <option value="">Select a role</option>
  //     //           <option value="gateKeeper">GateKeeper</option>
  //     //           <option value="reception">Reception</option>
  //     //         </select>
  //     //       </label>
  //     //       {errors.role && (
  //     //         <span className="text-sm font-medium text-red-600">
  //     //           {" "}
  //     //           {errors.role.message}
  //     //         </span>
  //     //       )}
  //     //       <label className="mt-1">
  //     //         <span className="block text:md after:content-['*'] after:ml-0.5 after:text-red-500 font-semibold  mt-1 text-copy-secondary ">
  //     //           Password
  //     //         </span>
  //     //         <input
  //     //           className="w-full p-1 mb-1 font-medium text-black border rounded peer focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 invalid:text-red-500 invalid:focus:border-red-500 invalid:focus:ring-red-500 placeholder:text-gray-400 "
  //     //           {...register("password", {
  //     //             required: "Password is required",
  //     //             minLength: 6,
  //     //           })}
  //     //           type="password"
  //     //           placeholder="Enter the password"
  //     //         />
  //     //       </label>
  //     //       {errors.password && (
  //     //         <span className="text-sm font-medium text-red-600">
  //     //           {errors.password.message}
  //     //         </span>
  //     //       )}
  //     //       <button
  //     //         className={`  transition-colors text-cta-text font-semibold w-full py-2 rounded-md mt-6 mb-4 flex items-center justify-center gap-2 ${
  //     //           mutation.isPending ? "cursor-not-allowed opacity-45" : ""
  //     //         }`}
  //     //         type="submit"
  //     //         disabled={mutation.isPending}
  //     //       >
  //     //         {mutation.isPending && (
  //     //           <span>
  //     //             <LoaderCircle
  //     //               strokeWidth={2}
  //     //               className="text-bg-cta animate-spin"
  //     //             />
  //     //           </span>
  //     //         )}
  //     //         Submit
  //     //       </button>
  //     //     </form>
  //     //   </div>

  //     //   <ToastContainer />
  //     // </div>
  //     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-12 px-4">

  //       {/* Header */}
  //             <header className="flex h-16 shrink-0 items-center gap-2 bg-white border-b px-6">
  //               <div className="flex items-center gap-2">
  //                 <SidebarTrigger className="-ml-8" />
  //                 <Separator orientation="vertical" className="mr-1 h-4" />
  //                 <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
  //             <Building2 className="w-8 h-8 text-white" />
  //           </div>
  //           <h1 className="text-3xl font-bold text-gray-900 mb-2">
  //             Create New Employee
  //           </h1>
  //           <p className="text-gray-600 text-lg">
  //             Add a new team member to your organization
  //           </p>
  //               </div>
  //             </header>

  //       <div className="max-w-2xl mx-auto">

  //         {/* Form Card */}
  //         <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
  //           <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600">
  //             <h2 className="text-xl font-semibold text-white">
  //               Employee Information
  //             </h2>
  //             <p className="text-blue-100 text-sm mt-1">
  //               Please fill in all required fields
  //             </p>
  //           </div>

  //           <div onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
  //             {/* Error Message */}
  //             {mutation.isError && errMsg && (
  //               <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
  //                 <div className="flex items-center">
  //                   <div className="flex-shrink-0">
  //                     <svg
  //                       className="h-5 w-5 text-red-400"
  //                       viewBox="0 0 20 20"
  //                       fill="currentColor"
  //                     >
  //                       <path
  //                         fillRule="evenodd"
  //                         d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
  //                         clipRule="evenodd"
  //                       />
  //                     </svg>
  //                   </div>
  //                   <div className="ml-3">
  //                     <p className="text-sm text-red-700">{errMsg}</p>
  //                   </div>
  //                 </div>
  //               </div>
  //             )}

  //             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  //               {/* Name Field */}
  //               <div className="space-y-2">
  //                 <label className="block text-sm font-semibold text-gray-700">
  //                   Full Name <span className="text-red-500">*</span>
  //                 </label>
  //                 <div className="relative">
  //                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
  //                     <User className="h-5 w-5 text-gray-400" />
  //                   </div>
  //                   <input
  //                     {...register("name")}
  //                     type="text"
  //                     placeholder="Enter full name"
  //                     className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
  //                       errors.name
  //                         ? "border-red-300 focus:ring-red-500 focus:border-red-500"
  //                         : "border-gray-300 hover:border-gray-400"
  //                     }`}
  //                   />
  //                 </div>
  //                 {errors.name && (
  //                   <p className="text-sm text-red-600 flex items-center gap-1">
  //                     <span className="w-1 h-1 bg-red-600 rounded-full"></span>
  //                     {errors.name.message}
  //                   </p>
  //                 )}
  //               </div>

  //               {/* Email Field */}
  //               <div className="space-y-2">
  //                 <label className="block text-sm font-semibold text-gray-700">
  //                   Email Address <span className="text-red-500">*</span>
  //                 </label>
  //                 <div className="relative">
  //                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
  //                     <Mail className="h-5 w-5 text-gray-400" />
  //                   </div>
  //                   <input
  //                     {...register("email")}
  //                     type="email"
  //                     placeholder="Enter email address"
  //                     className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
  //                       errors.email
  //                         ? "border-red-300 focus:ring-red-500 focus:border-red-500"
  //                         : "border-gray-300 hover:border-gray-400"
  //                     }`}
  //                   />
  //                 </div>
  //                 {errors.email && (
  //                   <p className="text-sm text-red-600 flex items-center gap-1">
  //                     <span className="w-1 h-1 bg-red-600 rounded-full"></span>
  //                     {errors.email.message}
  //                   </p>
  //                 )}
  //               </div>

  //               {/* Phone Number Field */}
  //               <div className="space-y-2">
  //                 <label className="block text-sm font-semibold text-gray-700">
  //                   Phone Number <span className="text-red-500">*</span>
  //                 </label>
  //                 <div className="relative">
  //                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
  //                     <Phone className="h-5 w-5 text-gray-400" />
  //                   </div>
  //                   <input
  //                     {...register("phoneNumber")}
  //                     type="tel"
  //                     placeholder="Enter 10-digit phone number"
  //                     className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
  //                       errors.phoneNumber
  //                         ? "border-red-300 focus:ring-red-500 focus:border-red-500"
  //                         : "border-gray-300 hover:border-gray-400"
  //                     }`}
  //                   />
  //                 </div>
  //                 {errors.phoneNumber && (
  //                   <p className="text-sm text-red-600 flex items-center gap-1">
  //                     <span className="w-1 h-1 bg-red-600 rounded-full"></span>
  //                     {errors.phoneNumber.message}
  //                   </p>
  //                 )}
  //               </div>

  //               {/* Role Field */}
  //               <div className="space-y-2">
  //                 <label className="block text-sm font-semibold text-gray-700">
  //                   Role <span className="text-red-500">*</span>
  //                 </label>
  //                 <div className="relative">
  //                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
  //                     <UserCheck className="h-5 w-5 text-gray-400" />
  //                   </div>
  //                   <select
  //                     {...register("role")}
  //                     className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none bg-white ${
  //                       errors.role
  //                         ? "border-red-300 focus:ring-red-500 focus:border-red-500"
  //                         : "border-gray-300 hover:border-gray-400"
  //                     }`}
  //                   >
  //                     <option value="">Select a role</option>
  //                     <option value="gateKeeper">Gate Keeper</option>
  //                     <option value="reception">Reception</option>
  //                   </select>
  //                   <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
  //                     <svg
  //                       className="h-5 w-5 text-gray-400"
  //                       viewBox="0 0 20 20"
  //                       fill="currentColor"
  //                     >
  //                       <path
  //                         fillRule="evenodd"
  //                         d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
  //                         clipRule="evenodd"
  //                       />
  //                     </svg>
  //                   </div>
  //                 </div>
  //                 {errors.role && (
  //                   <p className="text-sm text-red-600 flex items-center gap-1">
  //                     <span className="w-1 h-1 bg-red-600 rounded-full"></span>
  //                     {errors.role.message}
  //                   </p>
  //                 )}
  //               </div>
  //             </div>

  //             {/* Password Field - Full Width */}
  //             <div className="space-y-2">
  //               <label className="block text-sm font-semibold text-gray-700">
  //                 Password <span className="text-red-500">*</span>
  //               </label>
  //               <div className="relative">
  //                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
  //                   <Lock className="h-5 w-5 text-gray-400" />
  //                 </div>
  //                 <input
  //                   {...register("password")}
  //                   type="password"
  //                   placeholder="Enter secure password (min. 6 characters)"
  //                   className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
  //                     errors.password
  //                       ? "border-red-300 focus:ring-red-500 focus:border-red-500"
  //                       : "border-gray-300 hover:border-gray-400"
  //                   }`}
  //                 />
  //               </div>
  //               {errors.password && (
  //                 <p className="text-sm text-red-600 flex items-center gap-1">
  //                   <span className="w-1 h-1 bg-red-600 rounded-full"></span>
  //                   {errors.password.message}
  //                 </p>
  //               )}
  //             </div>

  //             {/* Submit Button */}
  //             <div className="pt-4">
  //               <button
  //                 onClick={handleSubmit(onSubmit)}
  //                 disabled={mutation.isPending}
  //                 className={`w-full py-3 px-6 rounded-lg text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
  //                   mutation.isPending
  //                     ? "bg-gray-400 cursor-not-allowed"
  //                     : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] shadow-lg hover:shadow-xl"
  //                 }`}
  //               >
  //                 {mutation.isPending ? (
  //                   <>
  //                     <LoaderCircle className="w-5 h-5 animate-spin" />
  //                     Creating Employee...
  //                   </>
  //                 ) : (
  //                   <>
  //                     <UserCheck className="w-5 h-5" />
  //                     Create Employee
  //                   </>
  //                 )}
  //               </button>
  //             </div>
  //           </div>
  //         </div>

  //         {/* Footer Note */}
  //         <div className="text-center mt-6">
  //           <p className="text-sm text-gray-500">
  //             All fields marked with <span className="text-red-500">*</span> are
  //             required
  //           </p>
  //         </div>
  //       </div>

  //       <ToastContainer position="top-right" autoClose={5000} />
  //     </div>
  //   );
};

export default CreateSaleEmployee;
