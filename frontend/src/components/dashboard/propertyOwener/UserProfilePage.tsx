import { useEffect, useState } from "react";
import { User, Upload, Camera, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getUserProfile, updateUserProfileImage } from "@/http/api";
import { updateAccessToken } from "@/features/auth/authSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { toast, ToastContainer } from "react-toastify";

// Zod schema for profile image upload
const profileImageSchema = z.object({
  userProfileImage: z
    .any()
    .refine((files) => files?.length === 1, "Profile image is required")
    .refine(
      (files) => files?.[0]?.size <= 5 * 1024 * 1024,
      "File size should be less than 5MB"
    )
    .refine(
      (files) => ["image/jpeg", "image/png", "image/jpg"].includes(files?.[0]?.type),
      "Only JPG, JPEG, and PNG files are allowed"
    ),
});

type ProfileImageForm = z.infer<typeof profileImageSchema>;

interface UserProfileData {
  name: string;
  role: string;
  email: string;
  phoneNumber: string;
  isEmailVerified: boolean;
  status: string;
  activeSessionsCount: number;
  userProfileUrl: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  employeeDetails?: {
    propertyOwnerId: string;
    propertyId: string;
    assignedAt: string;
  };
}

const UserProfilePage = () => {
  const [profileData, setProfileData] = useState<UserProfileData>({
    name: "",
    role: "",
    email: "",
    phoneNumber: "",
    isEmailVerified: false,
    status: "",
    activeSessionsCount: 0,
    userProfileUrl: "",
    id: "",
    createdAt: "",
    updatedAt: "",
  });

  const [imagePreview, setImagePreview] = useState<string>("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ProfileImageForm>({
    resolver: zodResolver(profileImageSchema),
  });

  const watchedImage = watch("userProfileImage");

  // Fetch user profile data using React Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    // staleTime: 5 * 60 * 1000, // 5 minutes
    // cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Profile image upload mutation
  const uploadImageMutation = useMutation({
    mutationKey: ["updateUserProfileImage"],
    mutationFn: updateUserProfileImage,
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Profile image updated successfully!");
        
        // Handle token updates if needed
        if (data.isAccessTokenExp && data.accessToken) {
          dispatch(updateAccessToken(data.accessToken));
          
          // Update session storage
          const userSessionData = JSON.parse(
            sessionStorage.getItem("user") || "{}"
          );
          userSessionData.accessToken = data.accessToken;
          
          if (data.refreshToken) {
            userSessionData.refreshToken = data.refreshToken;
          }
          
          sessionStorage.removeItem("user");
          sessionStorage.setItem("user", JSON.stringify(userSessionData));
        }

        // Update profile data with new image URL
        setProfileData(prev => ({
          ...prev,
          userProfileUrl: data.data.userProfileUrl
        }));

        // Invalidate and refetch profile data
        queryClient.invalidateQueries({ queryKey: ["userProfile"] });
        
        // Reset form and preview
        reset();
        setImagePreview("");
      } else {
        toast.error("Failed to update profile image");
      }
    },
    onError: (error: any) => {
      console.error("Profile image upload error:", error);
      const errorMessage = error?.response?.data?.message || "Failed to upload profile image";
      toast.error(errorMessage);
    },
  });

  // Handle profile data updates
  useEffect(() => {
    if (data && data.data) {
      const userData = data.data;
      setProfileData({
        name: userData.name || "",
        role: userData.role || "",
        email: userData.email || "",
        phoneNumber: userData.phoneNumber || "",
        isEmailVerified: userData.isEmailVerified || false,
        status: userData.status || "",
        activeSessionsCount: userData.activeSessionsCount || 0,
        userProfileUrl: userData.userProfileUrl || "",
        id: userData.id || "",
        createdAt: userData.createdAt || "",
        updatedAt: userData.updatedAt || "",
        ...(userData.employeeDetails && {
          employeeDetails: userData.employeeDetails
        })
      });

      // Handle token refresh if needed
      if (data.isAccessTokenExp) {
        const { accessToken, refreshToken } = data;
        if (accessToken && refreshToken) {
          const userSessionData = JSON.parse(
            sessionStorage.getItem("user") || "{}"
          );
          userSessionData.accessToken = accessToken;
          userSessionData.refreshToken = refreshToken;
          sessionStorage.removeItem("user");
          sessionStorage.setItem("user", JSON.stringify(userSessionData));
        }
        
        if (accessToken) {
          dispatch(updateAccessToken(accessToken));
          const userSessionData = JSON.parse(
            sessionStorage.getItem("user") || "{}"
          );
          userSessionData.accessToken = accessToken;
          sessionStorage.removeItem("user");
          sessionStorage.setItem("user", JSON.stringify(userSessionData));
        }
      }
    }
  }, [data, dispatch]);

  // Handle image preview
  useEffect(() => {
    if (watchedImage && watchedImage.length > 0) {
      const file = watchedImage[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview("");
    }
  }, [watchedImage]);

  // Handle form submission
  const onSubmit = (data: ProfileImageForm) => {
    const formData = new FormData();
    formData.append("userProfileImage", data.userProfileImage[0]);
    uploadImageMutation.mutate(formData);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 space-y-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
              <div className="flex items-center space-x-6 mb-6">
                <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-10 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Error fetching user profile:", error);
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Profile</h3>
              <p className="text-red-600 text-sm mt-1">
                Please try again later or contact support if the problem persists.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your account information
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile Image Section */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : profileData.userProfileUrl ? (
                  <img
                    src={profileData.userProfileUrl}
                    alt={profileData.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-600" />
                )}
              </div>
              {uploadImageMutation.isPending && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex space-x-2">
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    {...register("userProfileImage")}
                    accept="image/jpeg,image/png,image/jpg"
                    className="sr-only"
                  />
                  <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    <Camera className="w-4 h-4 mr-2" />
                    Choose Photo
                  </span>
                </label>
                
                {imagePreview && (
                  <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={uploadImageMutation.isPending}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploadImageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload
                  </button>
                )}
              </div>
              
              <p className="text-xs text-gray-500">JPG, PNG up to 5MB</p>
              
              {errors.userProfileImage && (
                <p className="text-xs text-red-600">
                  {errors.userProfileImage.message}
                </p>
              )}
            </div>
          </div>

          {/* User Information Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                {profileData.name || "N/A"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 capitalize">
                {profileData.role || "N/A"}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 flex items-center justify-between">
              <span>{profileData.email || "N/A"}</span>
              {profileData.isEmailVerified ? (
                <CheckCircle className="w-5 h-5 text-green-500" title="Verified" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" title="Not Verified" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
              {profileData.phoneNumber || "N/A"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Status
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  profileData.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {profileData.status || "N/A"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active Sessions
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                {profileData.activeSessionsCount}/5
              </div>
            </div>
          </div>

          {profileData.employeeDetails && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Details
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 text-gray-700 space-y-1">
                <div className="text-xs text-gray-600">
                  Property ID: {profileData.employeeDetails.propertyId}
                </div>
                <div className="text-xs text-gray-600">
                  Assigned: {formatDate(profileData.employeeDetails.assignedAt)}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Member Since
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 text-sm">
                {formatDate(profileData.createdAt)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Updated
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 text-sm">
                {formatDate(profileData.updatedAt)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
              Update Password
            </button>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Profile
            </button>
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" />
    </div>
  );
};

export default UserProfilePage;