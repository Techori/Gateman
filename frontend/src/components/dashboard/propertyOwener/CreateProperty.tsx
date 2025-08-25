import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { z } from "zod";
import { zodResolver } from '@hookform/resolvers/zod';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";
import { Upload, X, Plus, MapPin, Home, DollarSign, Calendar, Users, Settings, Image } from 'lucide-react';
import { createProperty } from '@/http/api';
import type { AxiosError } from 'axios';

// Zod Schema Definition
const propertySchema = z.object({
  // Basic Information
  name: z.string().min(1, "Property name is required"),
  description: z.string().optional(),
  type: z.string().optional(),
  
  // Location Information
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.coerce.number()
    .int("Pincode must be an integer")
    .min(100000, "Invalid pincode")
    .max(999999, "Invalid pincode"),
  landmark: z.string().optional(),
  googleMapLink: z.string().url("Invalid URL format").optional().or(z.literal("")),
  
  // Property Details
  floorSize: z.coerce.number()
    .positive("Floor size must be greater than 0"),
  totalFloor: z.coerce.number()
    .int("Total floors must be an integer")
    .min(1, "Must have at least 1 floor"),
  totalArea: z.coerce.number()
    .positive("Total area must be greater than 0")
    .optional(),
  seatingCapacity: z.coerce.number()
    .int("Seating capacity must be an integer")
    .min(1, "Must have at least 1 seat"),
  furnishingLevel: z.enum(["Fully Furnished", "Semi Furnished", "Unfurnished", ""]).optional(),
  
  // Pricing Information
  cost: z.coerce.number()
    .positive("Cost must be greater than 0"),
  totalCostPerSeat: z.coerce.number()
    .positive("Cost per seat must be greater than 0"),
  isPriceNegotiable: z.boolean().default(false),
  
  // Operating Hours
  isSaturdayOpened: z.boolean().default(true),
  isSundayOpened: z.boolean().default(false),
  
  // Arrays
  amenities: z.array(z.string()).default([]),
  unavailableDates: z.array(z.string()).default([])
});

// Type inference from schema
export type PropertyFormData = z.infer<typeof propertySchema>;

interface ErrorResponse {
  message: string;
}

const CreateProperty = () => {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [newDate, setNewDate] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      isSaturdayOpened: true,
      isSundayOpened: false,
      isPriceNegotiable: false,
      amenities: [],
      unavailableDates: [],
    },
  });

  const mutation = useMutation({
    mutationFn: createProperty,
    onSuccess: (data) => {
      console.log("api response data", data);
      alert('Property created successfully!');
      reset();
      setSelectedImages([]);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      console.log('Error creating property:', error);
      alert('Failed to create property. Please try again.');
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

  const watchedAmenities = watch('amenities') || [];
  const watchedDates = watch('unavailableDates') || [];

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
    if (newDate && !watchedDates.includes(newDate)) {
      setValue('unavailableDates', [...watchedDates, newDate]);
      setNewDate('');
    }
  };

  const removeUnavailableDate = (date: string) => {
    setValue('unavailableDates', watchedDates.filter(d => d !== date));
  };

  const onSubmit = (data: PropertyFormData) => {
    console.log("form data", data);
    
    if (selectedImages.length === 0) {
      alert('Please upload at least one property image');
      return;
    }

    const formData = new FormData();
    
    // Append all form fields (excluding propertyImages from form data)
    Object.entries(data).forEach(([key, value]) => {
      // Skip the propertyImages field as we handle it separately
      if (key === 'propertyImages') return;
      
      if (key === 'amenities' || key === 'unavailableDates') {
        // Send arrays as JSON strings
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        }
      } else if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value.toString());
      }
    });

    // CRITICAL FIX: Append images with the correct field name that matches multer config
    selectedImages.forEach((file, index) => {
      formData.append('propertyImage', file); // This must match multer field name
      console.log(`Appending image ${index + 1}:`, file.name, file.size);
    });

    // Debug: Log FormData contents
    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(key, value);
    }

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

      <div className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Home className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Name *
                </label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter property name"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type
                </label>
                <select
                  {...register('type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select property type</option>
                  {propertyTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter property description"
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Property Images */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Image className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Property Images</h2>
              <span className="text-sm text-gray-500">(Max 5 images, 4MB each)</span>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-gray-600">Click to upload images</p>
                  <p className="text-sm text-gray-500">PNG, JPG up to 4MB each</p>
                </label>
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
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Location Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  {...register('address')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Enter full address"
                />
                {errors.address && (
                  <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  {...register('city')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter city"
                />
                {errors.city && (
                  <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <input
                  {...register('state')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter state"
                />
                {errors.state && (
                  <p className="text-red-500 text-sm mt-1">{errors.state.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  {...register('pincode')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter pincode"
                />
                {errors.pincode && (
                  <p className="text-red-500 text-sm mt-1">{errors.pincode.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Landmark
                </label>
                <input
                  {...register('landmark')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter landmark"
                />
                {errors.landmark && (
                  <p className="text-red-500 text-sm mt-1">{errors.landmark.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Maps Link
                </label>
                <input
                  {...register('googleMapLink')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Google Maps link"
                />
                {errors.googleMapLink && (
                  <p className="text-red-500 text-sm mt-1">{errors.googleMapLink.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Property Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Floor Size (sq ft) *
                </label>
                <input
                  {...register('floorSize')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter floor size"
                />
                {errors.floorSize && (
                  <p className="text-red-500 text-sm mt-1">{errors.floorSize.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Floors *
                </label>
                <input
                  {...register('totalFloor')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter total floors"
                />
                {errors.totalFloor && (
                  <p className="text-red-500 text-sm mt-1">{errors.totalFloor.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Area (sq ft)
                </label>
                <input
                  {...register('totalArea')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter total area"
                />
                {errors.totalArea && (
                  <p className="text-red-500 text-sm mt-1">{errors.totalArea.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seating Capacity *
                </label>
                <input
                  {...register('seatingCapacity')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter seating capacity"
                />
                {errors.seatingCapacity && (
                  <p className="text-red-500 text-sm mt-1">{errors.seatingCapacity.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Furnishing Level
                </label>
                <select
                  {...register('furnishingLevel')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select furnishing level</option>
                  <option value="Fully Furnished">Fully Furnished</option>
                  <option value="Semi Furnished">Semi Furnished</option>
                  <option value="Unfurnished">Unfurnished</option>
                </select>
                {errors.furnishingLevel && (
                  <p className="text-red-500 text-sm mt-1">{errors.furnishingLevel.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Pricing Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost *
                </label>
                <input
                  {...register('cost')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter total cost"
                />
                {errors.cost && (
                  <p className="text-red-500 text-sm mt-1">{errors.cost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Per Seat *
                </label>
                <input
                  {...register('totalCostPerSeat')}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter cost per seat"
                />
                {errors.totalCostPerSeat && (
                  <p className="text-red-500 text-sm mt-1">{errors.totalCostPerSeat.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    {...register('isPriceNegotiable')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Price is negotiable</span>
                </label>
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Operating Hours</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    {...register('isSaturdayOpened')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Open on Saturday</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    {...register('isSundayOpened')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Open on Sunday</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unavailable Dates
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addUnavailableDate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                
                {watchedDates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {watchedDates.map((date, index) => (
                      <span
                        key={index}
                        className="bg-red-100 text-red-800 px-2 py-1 rounded-md flex items-center gap-1 text-sm"
                      >
                        {date}
                        <button
                          type="button"
                          onClick={() => removeUnavailableDate(date)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Amenities</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {commonAmenities.map(amenity => (
                  <label key={amenity} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={watchedAmenities.includes(amenity)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          addAmenity(amenity);
                        } else {
                          removeAmenity(amenity);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{amenity}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Custom Amenity
                </label>
                <div className="flex gap-2">
                  <input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom amenity"
                  />
                  <button
                    type="button"
                    onClick={addCustomAmenity}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {watchedAmenities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Amenities
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {watchedAmenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center gap-1 text-sm"
                      >
                        {amenity}
                        <button
                          type="button"
                          onClick={() => removeAmenity(amenity)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {errors.amenities && (
                <p className="text-red-500 text-sm">{errors.amenities.message}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => {
                reset();
                setSelectedImages([]);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Creating...' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProperty;