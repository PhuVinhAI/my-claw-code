// Extension: Real-time Tool Event Emission for Desktop UI
// 
// Problem: Core runtime's `run_turn()` only returns tool results after ALL tools complete.
// Desktop UI needs real-time updates: Tool 1 → Result 1 → Tool 2 → Result 2 (like CLI)
//
// Solution: Wrapper around ConversationRuntime that emits events during tool execution loop.
// This extension re-implements the tool execution loop from runtime/src/conversation.rs
// but adds callback support for real-time event emission.
//
// IMPORTANT: This is an EXACT COPY of core logic with ONE addition - callback invocation.
// When core changes, this must be updated to match.

use runtime::{
    ApiClient, ApiRequest, AssistantEvent, CompactionConfig, CompactionResult, 
    ConversationMessage, ContentBlock, PermissionOutcome, PermissionPolicy, 
    PermissionPrompter, RuntimeError, Session, ToolExecutor, TokenUsage, 
    TurnSummary, UsageTracker, RuntimeFeatureConfig, HookRunner,
};

/// Extended ConversationRuntime with real-time tool event callbacks
pub struct RealtimeConversationRuntime<C, T> {
    session: Session,
    api_client: C,
    tool_executor: T,
    permission_policy: PermissionPolicy,
    system_prompt: Vec<String>,
    max_iterations: usize,
    usage_tracker: UsageTracker,
    hook_runner: HookRunner,
}

impl<C, T> RealtimeConversationRuntime<C, T>
where
    C: ApiClient,
    T: ToolExecutor,
{
    pub fn new(
        session: Session,
        api_client: C,
        tool_executor: T,
        permission_policy: PermissionPolicy,
        system_prompt: Vec<String>,
        feature_config: RuntimeFeatureConfig,
    ) -> Self {
        let usage_tracker = UsageTracker::from_session(&session);
        Self {
            session,
            api_client,
            tool_executor,
            permission_policy,
            system_prompt,
            max_iterations: usize::MAX,
            usage_tracker,
            hook_runner: HookRunner::from_feature_config(&feature_config),
        }
    }

    pub fn with_max_iterations(mut self, max_iterations: usize) -> Self {
        self.max_iterations = max_iterations;
        self
    }

    /// Run turn with callback for each tool result (for real-time UI updates)
    /// 
    /// This is an EXACT COPY of runtime's run_turn() with ONE addition:
    /// Callback is invoked immediately after each tool execution completes.
    pub fn run_turn_with_callback<F>(
        &mut self,
        user_input: impl Into<String>,
        mut prompter: Option<&mut dyn PermissionPrompter>,
        mut on_tool_result: F,
    ) -> Result<TurnSummary, RuntimeError>
    where
        F: FnMut(&ConversationMessage),
    {
        self.session
            .messages
            .push(ConversationMessage::user_text(user_input.into()));

        let mut assistant_messages = Vec::new();
        let mut tool_results = Vec::new();
        let mut iterations = 0;

        loop {
            iterations += 1;
            if iterations > self.max_iterations {
                return Err(RuntimeError::new(
                    "conversation loop exceeded the maximum number of iterations",
                ));
            }

            let request = ApiRequest {
                system_prompt: self.system_prompt.clone(),
                messages: self.session.messages.clone(),
            };
            let events = self.api_client.stream(request)?;
            let (assistant_message, usage) = build_assistant_message(events)?;
            if let Some(usage) = usage {
                self.usage_tracker.record(usage);
            }
            let pending_tool_uses = assistant_message
                .blocks
                .iter()
                .filter_map(|block| match block {
                    ContentBlock::ToolUse { id, name, input } => {
                        Some((id.clone(), name.clone(), input.clone()))
                    }
                    _ => None,
                })
                .collect::<Vec<_>>();

            self.session.messages.push(assistant_message.clone());
            assistant_messages.push(assistant_message);

            if pending_tool_uses.is_empty() {
                break;
            }

            for (tool_use_id, tool_name, input) in pending_tool_uses {
                let permission_outcome = if let Some(prompt) = prompter.as_mut() {
                    self.permission_policy
                        .authorize(&tool_name, &input, Some(*prompt))
                } else {
                    self.permission_policy.authorize(&tool_name, &input, None)
                };

                let result_message = match permission_outcome {
                    PermissionOutcome::Allow => {
                        let pre_hook_result = self.hook_runner.run_pre_tool_use(&tool_name, &input);
                        if pre_hook_result.is_denied() {
                            let deny_message = format!("PreToolUse hook denied tool `{tool_name}`");
                            ConversationMessage::tool_result(
                                tool_use_id,
                                tool_name,
                                format_hook_message(&pre_hook_result, &deny_message),
                                true,
                            )
                        } else {
                            let (mut output, mut is_error) =
                                match self.tool_executor.execute(&tool_name, &input) {
                                    Ok(output) => (output, false),
                                    Err(error) => (error.to_string(), true),
                                };
                            output = merge_hook_feedback(pre_hook_result.messages(), output, false);

                            let post_hook_result = self
                                .hook_runner
                                .run_post_tool_use(&tool_name, &input, &output, is_error);
                            if post_hook_result.is_denied() {
                                is_error = true;
                            }
                            output = merge_hook_feedback(
                                post_hook_result.messages(),
                                output,
                                post_hook_result.is_denied(),
                            );

                            ConversationMessage::tool_result(
                                tool_use_id,
                                tool_name,
                                output,
                                is_error,
                            )
                        }
                    }
                    PermissionOutcome::Deny { reason } => {
                        ConversationMessage::tool_result(tool_use_id, tool_name, reason, true)
                    }
                };
                self.session.messages.push(result_message.clone());
                tool_results.push(result_message.clone());
                
                // ⭐ KEY DIFFERENCE: Emit event immediately after tool execution
                on_tool_result(&result_message);
            }
        }

        Ok(TurnSummary {
            assistant_messages,
            tool_results,
            iterations,
            usage: self.usage_tracker.cumulative_usage(),
        })
    }

    // Delegate other methods to match ConversationRuntime API
    pub fn compact(&self, config: CompactionConfig) -> CompactionResult {
        runtime::compact_session(&self.session, config)
    }

    pub fn estimated_tokens(&self) -> usize {
        runtime::estimate_session_tokens(&self.session)
    }

    pub fn usage(&self) -> &UsageTracker {
        &self.usage_tracker
    }

    pub fn session(&self) -> &Session {
        &self.session
    }

    pub fn into_session(self) -> Session {
        self.session
    }
}

// Helper functions copied from runtime/src/conversation.rs
// These are private in core, so we must duplicate them here.

fn build_assistant_message(
    events: Vec<AssistantEvent>,
) -> Result<(ConversationMessage, Option<TokenUsage>), RuntimeError> {
    let mut text = String::new();
    let mut blocks = Vec::new();
    let mut finished = false;
    let mut usage = None;

    for event in events {
        match event {
            AssistantEvent::TextDelta(delta) => text.push_str(&delta),
            AssistantEvent::ToolUse { id, name, input } => {
                flush_text_block(&mut text, &mut blocks);
                blocks.push(ContentBlock::ToolUse { id, name, input });
            }
            AssistantEvent::Usage(value) => usage = Some(value),
            AssistantEvent::MessageStop => {
                finished = true;
            }
        }
    }

    flush_text_block(&mut text, &mut blocks);

    if !finished {
        return Err(RuntimeError::new(
            "assistant stream ended without a message stop event",
        ));
    }
    if blocks.is_empty() {
        return Err(RuntimeError::new("assistant stream produced no content"));
    }

    Ok((
        ConversationMessage::assistant_with_usage(blocks, usage),
        usage,
    ))
}

fn flush_text_block(text: &mut String, blocks: &mut Vec<ContentBlock>) {
    if !text.is_empty() {
        blocks.push(ContentBlock::Text {
            text: std::mem::take(text),
        });
    }
}

fn format_hook_message(result: &runtime::HookRunResult, fallback: &str) -> String {
    if result.messages().is_empty() {
        fallback.to_string()
    } else {
        result.messages().join("\n")
    }
}

fn merge_hook_feedback(messages: &[String], output: String, denied: bool) -> String {
    if messages.is_empty() {
        return output;
    }

    let mut sections = Vec::new();
    if !output.trim().is_empty() {
        sections.push(output);
    }
    let label = if denied {
        "Hook feedback (denied)"
    } else {
        "Hook feedback"
    };
    sections.push(format!("{label}:\n{}", messages.join("\n")));
    sections.join("\n\n")
}
