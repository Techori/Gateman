import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { registerUser } from "@/http/api";
import { LoaderCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { AxiosError } from "axios";

interface ErrorResponse {
  message: string;
}

const formSchema = z.object({
  name: z.string()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(50, { message: "Name must not exceed 50 characters." })
    .regex(/^[a-zA-Z\s]+$/, { message: "Name can only contain letters and spaces." }),
  email: z.string()
    .email({ message: "Please enter a valid email address." }),
  role: z.enum(["client", "propertyOwener"], {
    message: "Please select either 'Client' or 'Property Owner'.",
  }),
    phoneNumber: z.string()
    .min(10, { message: "Phone number must be at least 10 digits." })
    .max(15, { message: "Phone number must not exceed 15 digits." })
    .regex(/^\d+$/, { message: "Phone number must be digits only." }),
  password: z.string()
    .min(6, { message: "Password must be at least 6 characters." })
    .max(100, { message: "Password must not exceed 100 characters." }),
  confirmPassword: z.string()
    .min(6, { message: "Please confirm your password." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

const RegisterForm = () => {
  const [errMsg, setErrMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      role: undefined,
    },
  });

  function onSubmit(values: FormData) {
    // Clear any previous error messages
    setErrMsg("");
    
    // Send all required fields to the API including role
    const registerData = {
      name: values.name,
      email: values.email,
      phoneNumber: values.phoneNumber,
      password: values.password,
      role: values.role,
    };
    console.log("Registration data:", registerData);
    
    mutation.mutate(registerData);
  }

  const mutation = useMutation({
    mutationKey: ["registerUser"],
    mutationFn: registerUser,
    onSuccess: (response) => {
      console.log("Registration response:", response);
      
      // Show success message or redirect to login with success message
      navigate("/auth/login", { 
        replace: true,
        state: { 
          message: "Registration successful! Please login with your credentials.",
          type: "success"
        }
      });
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      console.error("Registration error:", err.response?.data.message);
      const errorMessage = err.response?.data.message || "Registration failed. Please try again.";
      setErrMsg(errorMessage);
    },
  });

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-3xl font-bold">Create your account</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Enter your information below to create your account
            </p>
            {errMsg && (
              <span className="text-sm text-red-600 font-medium bg-red-50 px-3 py-2 rounded-md border border-red-200">
                {errMsg}
              </span>
            )}
          </div>

          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your full name"
                      type="text"
                      {...field}
                      autoComplete="name"
                      disabled={mutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter your full name as you'd like it to appear.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your email address"
                      type="email"
                      {...field}
                      autoComplete="email"
                      disabled={mutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    We'll use this email for your account verification.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your phone number"
                      type="string"
                      {...field}
                      autoComplete="tel"
                      disabled={mutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    We'll use this phone number for sending information.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={mutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="client">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Client</span>
                          <span className="text-xs text-muted-foreground">Looking for properties to rent</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="propertyOwener">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Property Owner</span>
                          <span className="text-xs text-muted-foreground">Have properties to rent out</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose whether you're looking for properties or listing them.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Create a strong password"
                        type={showPassword ? "text" : "password"}
                        {...field}
                        autoComplete="new-password"
                        disabled={mutation.isPending}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={mutation.isPending}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Password must be at least 6 characters long.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Confirm your password"
                        type={showConfirmPassword ? "text" : "password"}
                        {...field}
                        autoComplete="new-password"
                        disabled={mutation.isPending}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={mutation.isPending}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Re-enter your password to confirm.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full hover:cursor-pointer flex items-center justify-center gap-2"
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <LoaderCircle
                  strokeWidth={2}
                  className="h-4 w-4 animate-spin"
                />
              )}
              {mutation.isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="text-center text-sm mt-6">
        Already have an account?{" "}
        <Link 
          to="/auth/login" 
          className="underline underline-offset-4 hover:text-primary transition-colors"
        >
          Sign in
        </Link>
      </div>

      <div className="text-xs text-muted-foreground text-center mt-4 space-y-1">
        <p>By creating an account, you agree to our</p>
        <div className="space-x-4">
          <Link to="/terms" className="underline underline-offset-4 hover:text-primary transition-colors">
            Terms of Service
          </Link>
          <span>and</span>
          <Link to="/privacy" className="underline underline-offset-4 hover:text-primary transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;