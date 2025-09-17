import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "@/http/api";
// import type { AxiosError } from "axios";
import { deleteUser, updateAccessToken } from "@/features/auth/authSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { toast, ToastContainer } from "react-toastify";

const UserProfilePage = () => {
  const [profileData, setProfileData] = useState({
    name: "",
    role: "",
    email: "",
    phoneNumber: "",
    isEmailVerified: false,
    status: "",
    activeSessionsCount: 0,

    userProfileUrl: "",
  });
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Fetch user profile data using React Query

  const { data, isLoading, error } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

  useEffect(() => {
    if (data && data.data) {
      setProfileData({
        name: data.data.name || "",
        role: data.data.role || "",
        email: data.data.email || "",
        phoneNumber: data.data.phoneNumber || "",
        isEmailVerified: data.data.isEmailVerified || false,
        status: data.data.status || "",
        activeSessionsCount: data.data.activeSessionsCount || 0,
        userProfileUrl: data.data.userProfileUrl || "",
      });
      if (data.isAccessTokenExp) {
        const { accessToken, refreshToken } = data;
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
    }
  }, [data]);

  // handle loading and error states
  if (isLoading) return <div>Loading...</div>;
  if (error) {
    console.error("Error fetching user profile:", error);
    return <div>Error loading profile. Please try again later.</div>;
  }

  // const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const { name, value } = e.target;
  //   setProfileData((prev) => ({
  //     ...prev,
  //     [name]: value,
  //   }));
  // };

  // const handleSave = () => {
  //   alert("Profile updated successfully!");
  //   console.log("Profile data:", profileData);
  // };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your account information
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-12 h-12 text-gray-600" />
            </div>
            <div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Upload Photo
              </button>
              <p className="mt-1 text-xs text-gray-500">JPG, PNG up to 5MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={profileData.name}
                // onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={profileData.lastName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div> */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={profileData.email}
              // onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={profileData.phoneNumber}
              // onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company
            </label>
            <input
              type="text"
              name="company"
              value={profileData.company}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div> */}

          <div className="flex justify-end space-x-4">
            <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Update Password
            </button>
            <button
              // onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default UserProfilePage;
