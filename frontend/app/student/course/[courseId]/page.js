"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { currentUser } from "../../../../lib/auth";
import StudentCourseView from "../../../../modules/courseBuilder/StudentCourseView";

export default function StudentCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionUser = currentUser();
    if (!sessionUser || sessionUser.role !== "student") {
      router.push("/login");
      return;
    }
    setUser(sessionUser);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <StudentCourseView courseId={courseId} userId={user.id} />;
}
