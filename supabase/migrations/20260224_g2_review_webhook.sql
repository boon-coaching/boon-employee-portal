-- Webhook: notify Zapier when a survey comes in with coach_satisfaction = 10
-- Zapier then enrolls the contact in the HubSpot G2 review sequence

-- pg_net is pre-installed on Supabase hosted instances
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_zapier_high_satisfaction()
returns trigger as $$
begin
  if NEW.coach_satisfaction = 10 then
    perform net.http_post(
      url := 'https://hooks.zapier.com/hooks/catch/6769715/ucvly2h/',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'email', NEW.email,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'coach_satisfaction', NEW.coach_satisfaction,
        'nps', NEW.nps,
        'survey_type', NEW.survey_type,
        'coach_name', NEW.coach_name,
        'account_name', NEW.account_name,
        'program_title', NEW.program_title,
        'submitted_at', NEW.submitted_at
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_high_satisfaction_survey
  after insert on public.survey_submissions
  for each row
  execute function public.notify_zapier_high_satisfaction();
