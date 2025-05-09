// app/sessions/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import { TopBar } from '@/components/TopBar';
import { SessionLogger } from './_components/SessionLogger';
import { DayNavigator } from './_components/DayNavigator';
import { PlanCard, PlanDay } from './_components/PlanCard';
import { AddWorkoutModal } from './_components/AddWorkoutModal';
import { WorkoutHistory } from './_components/WorkoutHistory';
import { WorkoutChecklist } from './_components/WorkoutChecklist';
import { BottomNav } from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, BarChart } from 'lucide-react';

export default function SessionsPage() {
  const supabase = createClientComponentClient();
  const [day, setDay] = useState<number>(new Date().getDay());
  const [plan, setPlan] = useState<PlanDay | null>(null);
  const [logging, setLogging] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(true);

  // 1️⃣ Get current user
  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Fetch the profile ID associated with this user
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('userId', user.id)
          .single();
          
        if (profileData) {
          setProfileId(profileData.id);
        }
      }
    };
    
    fetchUserAndProfile();
  }, [supabase]);
  
  // 2️⃣ Fetch plan for a given weekday & user
  const fetchPlan = useCallback(async () => {
    if (!profileId) {
      setPlan(null);
      setLoadingPlan(false);
      return;
    }

    setLoadingPlan(true);
    const { data } = await supabase
      .from('workout_plans')
      .select('dayOfWeek, bodyPart, repeatWeekly')
      .eq('profileId', profileId)
      .eq('dayOfWeek', day)
      .single();

    if (data) {
      setPlan({
        dayIndex: data.dayOfWeek,
        bodyPart: data.bodyPart,
        repeatWeekly: data.repeatWeekly
      });
    } else {
      setPlan(null);
    }
    setTimeout(() => {
      setLoadingPlan(false);
    }, 1000);
  }, [day, profileId, supabase]);

  // 3️⃣ Reload whenever the profile or day changes
  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // 4️⃣ Upsert a new plan
  const handleSaved = async (newPlan: PlanDay & { repeatWeekly: boolean }) => {
    if (!profileId) return;
    const { error } = await supabase
      .from('workout_plans')
      .upsert(
        {
          profileId: profileId,
          dayOfWeek: newPlan.dayIndex,
          bodyPart: newPlan.bodyPart,
          repeatWeekly: newPlan.repeatWeekly
        },
        { onConflict: 'profileId,dayOfWeek' }
      );
    if (error) console.error('Plan save failed:', error);
    else fetchPlan();
  };

  // 5️⃣ Session logger
  if (logging && plan) {
    return <SessionLogger plan={plan} onEnd={() => setLogging(false)} />;
  }

  // 5️⃣-B Workout history view
  if (showHistory) {
    return <WorkoutHistory onClose={() => setShowHistory(false)} />;
  }

  // 6️⃣ Main UI
  return (
    <div className="pb-16">
      <TopBar title="Sessions"  actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1"
          >
            <BarChart className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </Button>
        }/>
      <div className="flex w-full gap-2 items-center px-4 py-2">
        <DayNavigator value={day} onChange={setDay} />
      </div>

      <div className="p-4 space-y-4">
        {loadingPlan ? (
          // Skeleton placeholder while loading
          <Card className='p-3'>
            <Skeleton className="h-[25px] w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </Card>
        ) : (
          <>
            <PlanCard
              plan={plan}
              onStart={() => setLogging(true)}
              onAdd={() => setShowAddModal(true)}
            />
            
            {/* Show workout checklist when a plan exists but not yet started */}
            {plan && (
              <div className="mt-6">
                <WorkoutChecklist workoutType={plan.bodyPart} />
              </div>
            )}
          </>
        )}
      </div>

      <AddWorkoutModal
        open={showAddModal}
        initialDay={day}
        onOpenChange={setShowAddModal}
        onSaved={handleSaved}
      />
      <BottomNav />
    </div>
  );
}
