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
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { login } from "@/http/api";
import { LoaderCircle } from "lucide-react";
import { useDispatch } from "react-redux";
import { addUserDetails } from "@/features/auth/authSlice";
import { useState } from "react";
import type { AxiosError } from "axios";

interface ErrorResponse {
  message: string;
}
const formSchema = z.object({
  password: z.string().min(6, {
    message: "password must be at least 6 characters.",
  }),
  email: z.email(),
});

const LoginForm = () => {
  const [errMsg, setErrMsg] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    mutation.mutate(values);
  }
  const mutation = useMutation({
    mutationKey: ["loginUser"],
    mutationFn: login,
    onSuccess: (response) => {
      console.log("login response :", response);
      console.log("response.data :", response.data);
      console.log("response.data.userDetails :", response.data.userDetails);
      const { id, name, email, role, isEmailVerified } =
        response.data.userDetails;
      const { accessToken, refreshToken, sessionId } = response.data;
      // console.log("id,name,email,role,isEmailVerified",id,name,email,role,isEmailVerified);
      // console.log("accessToken,refreshToken,sessionId",accessToken,refreshToken,sessionId);
      dispatch(
        addUserDetails({
          isLogin: true,
          accessToken,
          refreshToken,
          userId: id,
          useremail: email,
          userName: name,
          role,
          isEmailVerified,
          sessionId,
        })
      );
      const user = {
        id,
        name,
        email,
        role,
        isEmailVerified,
        accessToken,
        refreshToken,
        sessionId,
      };
      sessionStorage.setItem("user", JSON.stringify(user));
      const userData = JSON.parse(sessionStorage.getItem("user") || "{}");
      console.log("Retrieve user data from sessionStorage:", userData);
      console.log(
        "Retrieve user data from sessionStorage:",
        userData.accessToken
      );
      // TODO: ADD NAVIGATE ACCORDING TO ROLE
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      console.log("error on login", err.response?.data.message);
      const errorMeassge =
        err.response?.data.message || "Something went wrong.Try it again!";
      setErrMsg(errorMeassge);
    },
  });
  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-3xl font-bold">Login to your account</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Enter your email below to login to your account
            </p>
          </div>
          <div className="grid gap-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="email"
                      type="email"
                      {...field}
                      autoComplete="email"
                    />
                  </FormControl>
                  <FormDescription>Enter your email id.</FormDescription>
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
                    <Input
                      placeholder="password"
                      type="password"
                      {...field}
                      autoComplete="current-password"
                    />
                  </FormControl>
                  <FormDescription>Enter your password.</FormDescription>
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
                <span>
                  <LoaderCircle
                    strokeWidth={2}
                    className="text-bg-cta animate-spin"
                  />
                </span>
              )}
              Login
            </Button>
          </div>
        </form>
      </Form>
      <div className="text-center text-sm mt-6">
        Don&apos;t have an account?{" "}
        <Link to={"/auth/register"} className="underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
