/**
 * `SandboxedFileSystem`: the sandbox-enforcing implementation of the
 * `@deepseek-ai/dsh-fs` Service Definition. It extends `LocalFileSystem` so all
 * text-storage mechanics — resolve, stat, read/stream, list, the atomic
 * write and the read-match-write edit critical section — are the local
 * implementation's, verbatim; this package adds a per-call POLICY fence
 * on mutations and a deployment-owned protected configuration fence on reads.
 *
 * The fence is a policy check in TRUSTED code over a MODEL-CONTROLLED path,
 * NOT a kernel boundary — the operations are the seam's own (open, rename),
 * and only the target path is untrusted, so canonicalize-then-contain is the
 * complete answer to this surface. This is containment, not a security
 * boundary; kernel-grade isolation of untrusted CODE stays `ctx.shell`'s job
 * (`@deepseek-ai/dsh-bash-sandbox`). The residual
 * TOCTOU (an ancestor symlink swapped between the containment re-check and the
 * syscall) is narrowed by re-canonicalizing immediately before delegating and
 * is accepted for this threat model.
 *
 * Per-call policy: `read-only` denies every mutation; `workspace-write` allows
 * a mutation only when the target canonicalizes under the policy's workspace
 * root or a platform temp area from the shared `writableRoots` policy;
 * `danger-full-access` delegates unfenced. A denial throws the structured
 * `FS_SANDBOX_DENIED`.
 *
 * @module @deepseek-ai/dsh-fs-sandbox
 */
import { Context } from '@deepseek-ai/cordis';
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local';
import type { Config as LocalConfig } from '@deepseek-ai/dsh-fs-local';
import type { FsDirEntry, FsEditOutcome, FsEditRequest, FsInfo, FsPathInfo, FsTarget, FsVersion, FsWriteIntent, FsWriteOutcome } from '@deepseek-ai/dsh-fs';
import type { SandboxExecutionPolicy, SandboxMode } from '@deepseek-ai/dsh-sandbox';
/**
 * Plugin config: the local backend's knobs verbatim (`cwd` resolution default
 * and `diffBasisMaxBytes` overwrite-presentation bound). The sandbox default
 * (mode + `workspace-write` fallback root) is NOT here — `ctx.sandboxPolicy`
 * resolves each calling session for every enforcing capability.
 */
export type Config = LocalConfig;
/**
 * Sandbox-enforcing filesystem backend. Registers as `ctx.fs` (loading it
 * INSTEAD OF `dsh-fs-local`, together with a `ctx.sandboxPolicy`, is the whole
 * swap — the model-facing tools are untouched). Its configured default mode is
 * the capability fact exposed by {@link sandboxMode}; `dsh-tool-fs` resolves
 * each session's mode and cwd into a policy for every mutation, while an
 * approved escalation may stamp a strictly wider mode for one call.
 */
export declare class SandboxedFileSystem extends LocalFileSystem {
    static inject: string[];
    private readonly defaultMode;
    constructor(ctx: Context, config: Config);
    /** Private deployment config is never model-readable, including approved write escalations. */
    private protectedTarget;
    resolve(path: string, opts?: {
        cwd?: string;
        signal?: AbortSignal;
    }): Promise<FsTarget>;
    stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined>;
    lstat(path: string, opts?: {
        cwd?: string;
    }, signal?: AbortSignal): Promise<FsPathInfo | undefined>;
    readText(target: FsTarget, signal?: AbortSignal): Promise<string>;
    streamText(target: FsTarget, signal?: AbortSignal): Promise<AsyncIterable<string>>;
    readBytes(target: FsTarget, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>;
    readByteRange(target: FsTarget, range: {
        offset: number;
        length: number;
    }, signal?: AbortSignal): Promise<Uint8Array>;
    listDir(target: FsTarget, signal?: AbortSignal): Promise<FsDirEntry[]>;
    /** The deployment default mode — the capability fact the tool layer reads to advertise escalation. */
    get sandboxMode(): SandboxMode;
    /**
     * Fence the write by the per-call policy, then delegate to the inherited
     * atomic write. See {@link checkedTarget}.
     * @param target - the resolved target to write.
     * @param content - the full new file content.
     * @param expected - the write intent guarding the write; omit for unconditional.
     * @param signal - aborts before atomic publication takes effect.
     * @param sandboxPolicy - the per-call mode and workspace root; omit to use
     *   the deployment fallback.
     * @returns the write outcome from the inherited backend.
     */
    writeText(target: FsTarget, content: string, expected?: FsWriteIntent, signal?: AbortSignal, sandboxPolicy?: SandboxExecutionPolicy): Promise<FsWriteOutcome>;
    /**
     * Fence the edit by the per-call policy, then delegate to the inherited
     * atomic edit. See {@link checkedTarget}.
     * @param target - the resolved target to edit.
     * @param edit - the literal search/replace request.
     * @param expected - the version guard; omit for an unconditional edit.
     * @param signal - aborts before atomic publication takes effect.
     * @param sandboxPolicy - the per-call mode and workspace root; omit to use
     *   the deployment fallback.
     * @returns the edit outcome from the inherited backend.
     */
    editText(target: FsTarget, edit: FsEditRequest, expected?: {
        version: FsVersion;
    }, signal?: AbortSignal, sandboxPolicy?: SandboxExecutionPolicy): Promise<FsEditOutcome>;
    /**
     * Enforce the per-call policy against `target` and return the EXACT target the
     * mutation must use, so the checked identity is the mutated one (no
     * check-here-write-there TOCTOU). `read-only` denies; `workspace-write`
     * re-canonicalizes NOW (`resolve` realpaths the deepest existing ancestor,
     * reflecting a concurrently swapped symlink), requires containment under a
     * writable root, and returns THAT fresh target; `danger-full-access` returns
     * the caller's target unfenced. Throws the structured `FS_SANDBOX_DENIED` on
     * refusal — the tool layer maps it to the model-facing `[sandbox: …]` marker
     * and the escalation hint.
     */
    private checkedTarget;
}
export default SandboxedFileSystem;
//# sourceMappingURL=index.d.ts.map