/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { z } from "zod";
import { zodResolver } from '@hookform/resolvers/zod';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, X, Plus, MapPin, Home, DollarSign, Calendar as CalendarIcon, Users, Settings, Image, Clock, Shield, Navigation } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { createProperty, logoutUserBySessionId } from '@/http/api';
import type { AxiosError } from 'axios';
import { deleteUser, updateAccessToken } from '@/features/auth/authSlice';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { toast, ToastContainer } from "react-toastify";

// Updated Zod Schema to match new backend structure with explicit number transformations
const timeSlotSchema = z.object({
  day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
  isAvailable: z.boolean().default(true)
}).refine(data => data.startTime < data.endTime, {
  message: "Start time must be before end time",
  path: ["endTime"]
});

const pricingSchema = z.object({
  hourlyRate: z.number().positive().optional(),
  dailyRate: z.number().positive().optional(),
  weeklyRate: z.number().positive().optional(),
  monthlyRate: z.number().positive().optional(),
  cleaningFee: z.number().min(0).default(0),
  overtimeHourlyRate: z.number().positive().optional()
}).refine(data => {
  return data.hourlyRate || data.dailyRate || data.weeklyRate || data.monthlyRate;
}, {
  message: "At least one pricing option (hourly, daily, weekly, or monthly) is required",
  path: ["hourlyRate"]
});

const policiesSchema = z.object({
  guestPolicy: z.enum(["allowed", "not_allowed", "with_permission"]).default("with_permission"),
  eventHostingAllowed: z.boolean().default(false),
  smokingPolicy: z.enum(["allowed", "not_allowed", "designated_areas"]).default("not_allowed"),
  petPolicy: z.enum(["allowed", "not_allowed", "with_permission"]).default("not_allowed"),
  foodAndBeveragePolicy: z.enum(["allowed", "not_allowed", "outside_food_not_allowed"]).default("outside_food_not_allowed")
});

const locationSchema = z.object({
  nearestMetroStation: z.string().trim().optional(),
  distanceFromMetro: z.number().min(0).max(50).optional(),
  nearestBusStop: z.string().trim().optional(),
  distanceFromBusStop: z.number().min(0).max(10).optional(),
  nearestRailwayStation: z.string().trim().optional(),
  distanceFromRailway: z.number().min(0).max(100).optional()
});

const bookingRulesSchema = z.object({
  minBookingHours: z.number().min(1).max(24).default(1),
  maxBookingHours: z.number().min(1).max(1728).default(24),
  bufferHours: z.number().min(0).max(4).default(0.5),
  allowedTimeSlots: z.array(timeSlotSchema).default([]),
  checkoutGracePeriod: z.number().min(0).max(60).default(15)
});

const propertySchema = z.object({
  // Basic Information
  name: z.string().trim().min(1, "Property name is required"),
  description: z.string().trim().optional(),
  type: z.enum([
    "DayPass", 
    "Meeting Room", 
    "Coworking Space", 
    "Managed Office", 
    "Virtual office", 
    "Office/Commercial", 
    "Community Hall"
  ]).optional(),
  
  // Location Information
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: z.number()
    .int("Pincode must be an integer")
    .min(100000, "Invalid pincode")
    .max(999999, "Invalid pincode"),
  landmark: z.string().trim().optional(),
  googleMapLink: z.string().url("Invalid URL format").optional().or(z.literal("")),
  
  // Property Details
  floorSize: z.number().positive("Floor size must be greater than 0"),
  totalFloor: z.number().int("Total floors must be an integer").min(1, "Must have at least 1 floor"),
  totalArea: z.number().positive("Total area must be greater than 0").optional(),
  seatingCapacity: z.number().int("Seating capacity must be an integer").min(1, "Must have at least 1 seat"),
  furnishingLevel: z.string().trim().optional(),
  
  // Pricing Information (Legacy - still required for backend compatibility)
  cost: z.number().positive("Cost must be greater than 0"),
  totalCostPerSeat: z.number().positive("Cost per seat must be greater than 0"),
  isPriceNegotiable: z.boolean().default(false),
  
  // Operating Hours
  isSaturdayOpened: z.boolean().default(true),
  isSundayOpened: z.boolean().default(false),
  
  // Arrays
  amenities: z.array(z.string().trim()).nonempty("At least one amenity is required"),
  unavailableDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")).optional(),
  
  // New structured data
  pricing: pricingSchema,
  policies: policiesSchema,
  location: locationSchema,
  bookingRules: bookingRulesSchema
});

export type PropertyFormData = z.infer<typeof propertySchema>;

interface ErrorResponse {
  message: string;
}

// Transform function to handle form data conversion
const transformFormData = (data: any): PropertyFormData => {
  return {
    ...data,
    pincode: Number(data.pincode),
    floorSize: Number(data.floorSize),
    totalFloor: Number(data.totalFloor),
    totalArea: data.totalArea ? Number(data.totalArea) : undefined,
    seatingCapacity: Number(data.seatingCapacity),
    cost: Number(data.cost),
    totalCostPerSeat: Number(data.totalCostPerSeat),
    pricing: {
      hourlyRate: data.pricing.hourlyRate ? Number(data.pricing.hourlyRate) : undefined,
      dailyRate: data.pricing.dailyRate ? Number(data.pricing.dailyRate) : undefined,
      weeklyRate: data.pricing.weeklyRate ? Number(data.pricing.weeklyRate) : undefined,
      monthlyRate: data.pricing.monthlyRate ? Number(data.pricing.monthlyRate) : undefined,
      cleaningFee: Number(data.pricing.cleaningFee || 0),
      overtimeHourlyRate: data.pricing.overtimeHourlyRate ? Number(data.pricing.overtimeHourlyRate) : undefined
    },
    location: {
      ...data.location,
      distanceFromMetro: data.location.distanceFromMetro ? Number(data.location.distanceFromMetro) : undefined,
      distanceFromBusStop: data.location.distanceFromBusStop ? Number(data.location.distanceFromBusStop) : undefined,
      distanceFromRailway: data.location.distanceFromRailway ? Number(data.location.distanceFromRailway) : undefined
    },
    bookingRules: {
      ...data.bookingRules,
      minBookingHours: Number(data.bookingRules.minBookingHours || 1),
      maxBookingHours: Number(data.bookingRules.maxBookingHours || 24),
      bufferHours: Number(data.bookingRules.bufferHours || 0.5),
      checkoutGracePeriod: Number(data.bookingRules.checkoutGracePeriod || 15)
    }
  };
};

const CreateProperty = () => {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      isSaturdayOpened: true,
      isSundayOpened: false,
      isPriceNegotiable: false,
      amenities: [],
      unavailableDates: [],
      pricing: {
        cleaningFee: 0
      },
      policies: {
        guestPolicy: "with_permission" as const,
        eventHostingAllowed: false,
        smokingPolicy: "not_allowed" as const,
        petPolicy: "not_allowed" as const,
        foodAndBeveragePolicy: "outside_food_not_allowed" as const
      },
      location: {},
      bookingRules: {
        minBookingHours: 1,
        maxBookingHours: 24,
        bufferHours: 0.5,
        allowedTimeSlots: [],
        checkoutGracePeriod: 15
      }
    },
  });

  const mutation = useMutation({
    mutationFn: createProperty,
    onSuccess: (response) => {
      console.log("API response data", response);
      
      toast.success(response.message, { position: "top-right" });
      reset();
      setSelectedImages([]);
      // update access and refresh token
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
    },

    onError: async(err: AxiosError<ErrorResponse>) => {
      console.log('Error creating property:', err);
      const message = err.response?.data?.message || 'Failed to create property. Please try again.';
      toast.error(message);
      
      // Only logout user if refresh token is expired/invalid (not just access token)
      if (err.response?.status === 401) {
        console.log("err.response?.status :", err.response?.status);
        
        // Check if the error message indicates refresh token issues
        const errorMessage = err.response?.data?.message?.toLowerCase() || '';
        const isRefreshTokenError = 
          errorMessage.includes('refresh token') ||
          errorMessage.includes('session expired') ||
          errorMessage.includes('session mismatch') ||
          errorMessage.includes('please log in again') ||
          errorMessage.includes('invalid or expired refresh token');
        
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
    },
  });

  const propertyTypes = [
    'DayPass',
    'Meeting Room',
    'Coworking Space',
    'Managed Office',
    'Virtual office',
    'Office/Commercial',
    'Community Hall',
  ];

  const commonAmenities = [
    '2 wheeler parking',
    '4 wheeler parking',
    'Fire Extinguisher',
    'Security Personnel',
    'First Aid Kit',
    'Private cabins',
    'Pantry',
    'Reception area',
    'Wi-Fi',
    'Air Conditioning',
    'Power Backup',
    'CCTV',
  ];

  const furnishingLevels = [
    'unfurnished',
    'semi_furnished', 
    'fully_furnished'
  ];

  const dayOptions = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const watchedAmenities = watch('amenities') || [];
  const watchedDates = watch('unavailableDates') || [];
  const watchedTimeSlots = watch('bookingRules.allowedTimeSlots') || [];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (selectedImages.length + files.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > 4 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 4MB.`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file.`);
        return false;
      }
      return true;
    });

    setSelectedImages(prev => [...prev, ...validFiles]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const addAmenity = (amenity: string) => {
    const currentAmenities = watchedAmenities;
    if (!currentAmenities.includes(amenity)) {
      setValue('amenities', [...currentAmenities, amenity]);
    }
  };

  const removeAmenity = (amenity: string) => {
    const currentAmenities = watchedAmenities;
    setValue('amenities', currentAmenities.filter(a => a !== amenity));
  };

  const addCustomAmenity = () => {
    if (newAmenity.trim() && !watchedAmenities.includes(newAmenity.trim())) {
      setValue('amenities', [...watchedAmenities, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  const addUnavailableDate = () => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      if (!watchedDates.includes(dateString)) {
        setValue('unavailableDates', [...watchedDates, dateString]);
        setSelectedDate(undefined);
        setCalendarOpen(false);
      }
    }
  };

  const removeUnavailableDate = (date: string) => {
    setValue('unavailableDates', watchedDates.filter(d => d !== date));
  };

  const addTimeSlot = () => {
    const newSlot = {
      day: "monday" as const,
      startTime: "09:00",
      endTime: "18:00",
      isAvailable: true
    };
    setValue('bookingRules.allowedTimeSlots', [...watchedTimeSlots, newSlot]);
  };

  const updateTimeSlot = (index: number, field: keyof (typeof watchedTimeSlots)[0], value: any) => {
    const updatedSlots = [...watchedTimeSlots];
    updatedSlots[index] = { ...updatedSlots[index], [field]: value };
    setValue('bookingRules.allowedTimeSlots', updatedSlots);
  };

  const removeTimeSlot = (index: number) => {
    setValue('bookingRules.allowedTimeSlots', watchedTimeSlots.filter((_, i) => i !== index));
  };

  // Fix the onSubmit function with proper typing and transformation
  const onSubmit = (rawData: PropertyFormData) => {
    console.log("Raw form data", rawData);
    
    if (selectedImages.length === 0) {
        alert('Please upload at least one property image');
        return;
    }

    // Transform and validate the data
    const data = transformFormData(rawData);
    console.log("Transformed form data", data);
    
    const formData = new FormData();
    
    // Append all form fields
    Object.entries(data).forEach(([key, value]) => {
        if (key === 'amenities' || key === 'unavailableDates') {
            if (Array.isArray(value)) {
                formData.append(key, JSON.stringify(value));
            }
        } else if (key === 'pricing' || key === 'policies' || key === 'location') {
            formData.append(key, JSON.stringify(value));
        } else if (key === 'bookingRules') {
            const bookingRulesData = {
                minBookingHours: data.bookingRules.minBookingHours,
                maxBookingHours: data.bookingRules.maxBookingHours,
                bufferHours: data.bookingRules.bufferHours,
                allowedTimeSlots: data.bookingRules.allowedTimeSlots,
                checkoutGracePeriod: data.bookingRules.checkoutGracePeriod
            };
            console.log('Sending bookingRules:', bookingRulesData);
            formData.append(key, JSON.stringify(bookingRulesData));
        } else if (value !== undefined && value !== null && value !== '') {
            formData.append(key, value.toString());
        }
    });

    // Debug: Log what's being sent
    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
        console.log(key, value);
    }

    // Append images
    selectedImages.forEach((file) => {
        formData.append('propertyImage', file);
    });

    mutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 bg-white border-b px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-8" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <h1 className="text-lg font-semibold">Create New Property</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-blue-600" />
                <CardTitle>Basic Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Property Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Enter property name"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Property Type</Label>
                  <Select onValueChange={(value) => setValue('type', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-red-500 text-sm">{errors.type.message}</p>
                  )}
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Enter property description (max 2000 characters)"
                    maxLength={2000}
                    rows={3}
                  />
                  {errors.description && (
                    <p className="text-red-500 text-sm">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Images */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Image className="h-5 w-5 text-blue-600" />
                <CardTitle>Property Images</CardTitle>
                <CardDescription>(Max 5 images, 4MB each)</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                  <Upload className="h-12 w-12 text-gray-400" />
                  <span>Click to upload images</span>
                  <span className="text-sm text-gray-500">PNG, JPG up to 4MB each</span>
                </Label>
              </div>

              {selectedImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {selectedImages.map((file, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <CardTitle>Location Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    {...register('address')}
                    placeholder="Enter full address"
                    rows={2}
                  />
                  {errors.address && (
                    <p className="text-red-500 text-sm">{errors.address.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    placeholder="Enter city"
                  />
                  {errors.city && (
                    <p className="text-red-500 text-sm">{errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    {...register('state')}
                    placeholder="Enter state"
                  />
                  {errors.state && (
                    <p className="text-red-500 text-sm">{errors.state.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    type="number"
                    {...register('pincode', { valueAsNumber: true })}
                    placeholder="Enter 6-digit pincode"
                  />
                  {errors.pincode && (
                    <p className="text-red-500 text-sm">{errors.pincode.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="landmark">Landmark</Label>
                  <Input
                    id="landmark"
                    {...register('landmark')}
                    placeholder="Enter landmark"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="googleMapLink">Google Maps Link</Label>
                  <Input
                    id="googleMapLink"
                    {...register('googleMapLink')}
                    placeholder="Enter Google Maps link"
                  />
                  {errors.googleMapLink && (
                    <p className="text-red-500 text-sm">{errors.googleMapLink.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transportation Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                <CardTitle>Transportation & Accessibility</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nearestMetroStation">Nearest Metro Station</Label>
                  <Input
                    id="nearestMetroStation"
                    {...register('location.nearestMetroStation')}
                    placeholder="Enter nearest metro station"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distanceFromMetro">Distance from Metro (km)</Label>
                  <Input
                    id="distanceFromMetro"
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    {...register('location.distanceFromMetro', { valueAsNumber: true })}
                    placeholder="Distance in kilometers"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nearestBusStop">Nearest Bus Stop</Label>
                  <Input
                    id="nearestBusStop"
                    {...register('location.nearestBusStop')}
                    placeholder="Enter nearest bus stop"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distanceFromBusStop">Distance from Bus Stop (km)</Label>
                  <Input
                    id="distanceFromBusStop"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    {...register('location.distanceFromBusStop', { valueAsNumber: true })}
                    placeholder="Distance in kilometers"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nearestRailwayStation">Nearest Railway Station</Label>
                  <Input
                    id="nearestRailwayStation"
                    {...register('location.nearestRailwayStation')}
                    placeholder="Enter nearest railway station"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distanceFromRailway">Distance from Railway (km)</Label>
                  <Input
                    id="distanceFromRailway"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    {...register('location.distanceFromRailway', { valueAsNumber: true })}
                    placeholder="Distance in kilometers"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                <CardTitle>Property Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="floorSize">Floor Size (sq ft) *</Label>
                  <Input
                    id="floorSize"
                    type="number"
                    min="1"
                    {...register('floorSize', { valueAsNumber: true })}
                    placeholder="Enter floor size"
                  />
                  {errors.floorSize && (
                    <p className="text-red-500 text-sm">{errors.floorSize.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalFloor">Total Floors *</Label>
                  <Input
                    id="totalFloor"
                    type="number"
                    min="1"
                    {...register('totalFloor', { valueAsNumber: true })}
                    placeholder="Enter total floors"
                  />
                  {errors.totalFloor && (
                    <p className="text-red-500 text-sm">{errors.totalFloor.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalArea">Total Area (sq ft)</Label>
                  <Input
                    id="totalArea"
                    type="number"
                    min="1"
                    {...register('totalArea', { valueAsNumber: true })}
                    placeholder="Enter total area"
                  />
                  {errors.totalArea && (
                    <p className="text-red-500 text-sm">{errors.totalArea.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seatingCapacity">Seating Capacity *</Label>
                  <Input
                    id="seatingCapacity"
                    type="number"
                    min="1"
                    {...register('seatingCapacity', { valueAsNumber: true })}
                    placeholder="Enter seating capacity"
                  />
                  {errors.seatingCapacity && (
                    <p className="text-red-500 text-sm">{errors.seatingCapacity.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="furnishingLevel">Furnishing Level</Label>
                  <Select onValueChange={(value) => setValue('furnishingLevel', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select furnishing level" />
                    </SelectTrigger>
                    <SelectContent>
                      {furnishingLevels.map(level => (
                        <SelectItem key={level} value={level}>
                          {level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Structure */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <CardTitle>Pricing Structure</CardTitle>
                <CardDescription>Set at least one pricing option</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Hourly Rate</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('pricing.hourlyRate', { valueAsNumber: true })}
                    placeholder="Enter hourly rate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dailyRate">Daily Rate</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('pricing.dailyRate', { valueAsNumber: true })}
                    placeholder="Enter daily rate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weeklyRate">Weekly Rate</Label>
                  <Input
                    id="weeklyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('pricing.weeklyRate', { valueAsNumber: true })}
                    placeholder="Enter weekly rate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyRate">Monthly Rate</Label>
                  <Input
                    id="monthlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('pricing.monthlyRate', { valueAsNumber: true })}
                    placeholder="Enter monthly rate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cleaningFee">Cleaning Fee</Label>
                  <Input
                    id="cleaningFee"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('pricing.cleaningFee', { valueAsNumber: true })}
                    placeholder="Enter cleaning fee (default: 0)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overtimeHourlyRate">Overtime Hourly Rate</Label>
                  <Input
                    id="overtimeHourlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('pricing.overtimeHourlyRate', { valueAsNumber: true })}
                    placeholder="Enter overtime rate (optional)"
                  />
                </div>
              </div>
              
              {errors.pricing && (
                <p className="text-red-500 text-sm">{errors.pricing.message}</p>
              )}

              {/* Legacy Pricing Fields - Still required for backend compatibility */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost">Total Cost *</Label>
                    <Input
                      id="cost"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('cost', { valueAsNumber: true })}
                      placeholder="Enter total cost"
                    />
                    {errors.cost && (
                      <p className="text-red-500 text-sm">{errors.cost.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalCostPerSeat">Cost Per Seat *</Label>
                    <Input
                      id="totalCostPerSeat"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('totalCostPerSeat', { valueAsNumber: true })}
                      placeholder="Enter cost per seat"
                    />
                    {errors.totalCostPerSeat && (
                      <p className="text-red-500 text-sm">{errors.totalCostPerSeat.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isPriceNegotiable"
                        onCheckedChange={(checked) => setValue('isPriceNegotiable', checked as boolean)}
                      />
                      <Label htmlFor="isPriceNegotiable">Price is negotiable</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Rules */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <CardTitle>Booking Rules</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minBookingHours">Min Booking Hours</Label>
                  <Input
                    id="minBookingHours"
                    type="number"
                    min="1"
                    max="24"
                    {...register('bookingRules.minBookingHours', { valueAsNumber: true })}
                    placeholder="Minimum hours"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxBookingHours">Max Booking Hours</Label>
                  <Input
                    id="maxBookingHours"
                    type="number"
                    min="1"
                    max="1728"
                    {...register('bookingRules.maxBookingHours', { valueAsNumber: true })}
                    placeholder="Maximum hours"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bufferHours">Buffer Hours</Label>
                  <Input
                    id="bufferHours"
                    type="number"
                    min="0"
                    max="4"
                    step="0.25"
                    {...register('bookingRules.bufferHours', { valueAsNumber: true })}
                    placeholder="Buffer time (0.5 = 30min)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkoutGracePeriod">Checkout Grace Period (min)</Label>
                  <Input
                    id="checkoutGracePeriod"
                    type="number"
                    min="0"
                    max="60"
                    {...register('bookingRules.checkoutGracePeriod', { valueAsNumber: true })}
                    placeholder="Grace period in minutes"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Allowed Time Slots</Label>
                  <Button type="button" onClick={addTimeSlot} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Time Slot
                  </Button>
                </div>

                {watchedTimeSlots.map((slot, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <Select
                      value={slot.day}
                      onValueChange={(value) => updateTimeSlot(index, 'day', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dayOptions.map(day => (
                          <SelectItem key={day} value={day}>
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                      className="w-32"
                    />

                    <span className="text-sm text-gray-500">to</span>

                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                      className="w-32"
                    />

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={slot.isAvailable}
                        onCheckedChange={(checked) => updateTimeSlot(index, 'isAvailable', checked)}
                      />
                      <Label className="text-sm">Available</Label>
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeTimeSlot(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Policies */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <CardTitle>Property Policies</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guestPolicy">Guest Policy</Label>
                  <Select
                    onValueChange={(value) => setValue('policies.guestPolicy', value as any)}
                    defaultValue="with_permission"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="not_allowed">Not Allowed</SelectItem>
                      <SelectItem value="with_permission">With Permission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smokingPolicy">Smoking Policy</Label>
                  <Select
                    onValueChange={(value) => setValue('policies.smokingPolicy', value as any)}
                    defaultValue="not_allowed"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="not_allowed">Not Allowed</SelectItem>
                      <SelectItem value="designated_areas">Designated Areas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="petPolicy">Pet Policy</Label>
                  <Select
                    onValueChange={(value) => setValue('policies.petPolicy', value as any)}
                    defaultValue="not_allowed"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="not_allowed">Not Allowed</SelectItem>
                      <SelectItem value="with_permission">With Permission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foodAndBeveragePolicy">Food & Beverage Policy</Label>
                  <Select
                    onValueChange={(value) => setValue('policies.foodAndBeveragePolicy', value as any)}
                    defaultValue="outside_food_not_allowed"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="not_allowed">Not Allowed</SelectItem>
                      <SelectItem value="outside_food_not_allowed">Outside Food Not Allowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="eventHostingAllowed"
                      onCheckedChange={(checked) => setValue('policies.eventHostingAllowed', checked as boolean)}
                    />
                    <Label htmlFor="eventHostingAllowed">Event hosting allowed</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
                <CardTitle>Operating Hours</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isSaturdayOpened"
                    onCheckedChange={(checked) => setValue('isSaturdayOpened', checked as boolean)}
                    defaultChecked={true}
                  />
                  <Label htmlFor="isSaturdayOpened">Open on Saturday</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isSundayOpened"
                    onCheckedChange={(checked) => setValue('isSundayOpened', checked as boolean)}
                  />
                  <Label htmlFor="isSundayOpened">Open on Sunday</Label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Unavailable Dates</Label>
                  <p className="text-sm text-gray-500 mb-2">Select dates when the property is not available</p>
                  
                  <div className="flex gap-2 mb-2">
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button type="button" onClick={addUnavailableDate}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Date
                    </Button>
                  </div>
                  
                  {watchedDates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {watchedDates.map((date, index) => (
                        <div
                          key={index}
                          className="bg-red-100 text-red-800 px-2 py-1 rounded-md flex items-center gap-1 text-sm"
                        >
                          {format(new Date(date), "MMM dd, yyyy")}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUnavailableDate(date)}
                            className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <CardTitle>Amenities *</CardTitle>
                <CardDescription>(At least one required)</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {commonAmenities.map(amenity => (
                  <div key={amenity} className="flex items-center space-x-2">
                    <Checkbox
                      id={amenity}
                      checked={watchedAmenities.includes(amenity)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          addAmenity(amenity);
                        } else {
                          removeAmenity(amenity);
                        }
                      }}
                    />
                    <Label htmlFor={amenity} className="text-sm">{amenity}</Label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Add Custom Amenity</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Enter custom amenity"
                    className="flex-1"
                  />
                  <Button type="button" onClick={addCustomAmenity}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {watchedAmenities.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Amenities ({watchedAmenities.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {watchedAmenities.map((amenity, index) => (
                      <div
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center gap-1 text-sm"
                      >
                        {amenity}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAmenity(amenity)}
                          className="h-4 w-4 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {errors.amenities && (
                <p className="text-red-500 text-sm">{errors.amenities.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setSelectedImages([]);
                setNewAmenity('');
                setSelectedDate(undefined);
              }}
              disabled={mutation.isPending}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="min-w-32"
            >
              {mutation.isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              )}
              {mutation.isPending ? 'Creating...' : 'Create Property'}
            </Button>
          </div>
        </form>
      </div>
      <ToastContainer/>
    </div>
  );
};

export default CreateProperty;