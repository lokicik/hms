"use client";

import { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { setToken, isAuthenticated } from "@/utils/auth";

const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const fakeToken = "demo-jwt-token";

      setToken(fakeToken);

      message.success("Login successful!");

      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    } catch (error) {
      message.error("Failed to login: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 400, boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2}>Hotel Management System</Title>
          <p>Please log in to continue</p>
        </div>

        <Form
          name="login_form"
          className="login-form"
          initialValues={{ username: "admin", password: "admin" }}
          onFinish={onFinish}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Please input your Username!" }]}
          >
            <Input
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="Username"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Please input your Password!" }]}
          >
            <Input
              prefix={<LockOutlined className="site-form-item-icon" />}
              type="password"
              placeholder="Password"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="login-form-button"
              loading={loading}
              size="large"
            >
              Log in
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center", marginTop: 10 }}>
            <small>For demo, use any username and password</small>
          </div>
        </Form>
      </Card>
    </div>
  );
}
