// OOPS concept index: hand-written explanations anchored to real DigiVote source.
//
// Nothing here is source code. Each reference names a real file and finds its excerpt and highlighted
// lines by anchor text, so build-index.mjs can resolve line numbers from the current repository and
// fail loudly if a line moves or disappears. Explanations are authored text and are labelled as such.

const B = 'backend/src/main/java/com/digivote/';
const F = 'frontend/src/';

// range: [first line containing a, first later line containing b]; after: skip to this text first.
// marks: highlighted lines, matched inside the range by exact text.

export const GROUPS = ['Core concepts', 'Members and modifiers', 'Relationships', 'Language features', 'Design patterns', 'Not found in DigiVote'];

export const CONCEPTS = [
  // ------------------------------------------------------------------------------------------- core
  {
    id: 'classes-objects', name: 'Classes and objects', group: 'Core concepts', status: 'found',
    definition: 'A class is a blueprint that bundles state (fields) and behaviour (methods). An object is one instance of it, created with new, holding its own copy of the fields.',
    why: 'Each manifesto a candidate writes is one Manifesto object. The class carries both the text and the rule that a manifesto cannot change after voting opens, so every manifesto in the system obeys the same rule.',
    workflow: 'When an administrator approves a candidate application, CandidateService creates the Candidate and then a fresh Manifesto object for it. Later edits load that object, call its methods, and JPA saves it back to the manifestos table.',
    viva: { q: 'In DigiVote, where is a Manifesto object created and what state does it start with?', a: 'In CandidateService.createCandidate, with new Manifesto(candidate.getId(), now). The constructor sets the candidate id, status DRAFT and updatedAt; frozen starts false.' },
    refs: [
      { file: B + 'candidate/Manifesto.java', symbol: 'class Manifesto', role: 'Class declaration', lang: 'java',
        range: ['@Entity', 'public void edit('],
        marks: [
          { at: 'public class Manifesto {', note: 'The class declaration: the blueprint every manifesto object is built from.' },
          { at: 'private Long candidateId;', note: 'A field. Every Manifesto object has its own candidateId linking it to one candidate.' },
          { at: 'private boolean frozen;', note: 'Instance state that later decides whether the object accepts edits.' },
          { at: 'public Manifesto(Long candidateId, Instant now) {', note: 'The constructor that sets up a new object in a valid starting state.' },
          { at: 'this.status = Status.DRAFT;', note: 'Every new manifesto starts as a draft.' },
        ] },
      { file: B + 'candidate/CandidateService.java', symbol: 'CandidateService.createCandidate', role: 'Object creation (call site)', lang: 'java',
        range: ['private void createCandidate(', 'manifestos.save(new Manifesto('],
        marks: [
          { at: 'new Candidate(app, position, now)', note: 'A Candidate object is instantiated from the approved application.' },
          { at: 'manifestos.save(new Manifesto(candidate.getId(), now));', note: 'new creates the Manifesto object; the repository then persists it.' },
        ] },
    ],
  },
  {
    id: 'encapsulation', name: 'Encapsulation', group: 'Core concepts', status: 'found',
    definition: 'Encapsulation hides an object\'s state behind private fields and lets it change only through methods that enforce the object\'s rules.',
    why: 'Manifestos must freeze when voting opens so candidates cannot change promises mid-vote. Keeping the fields private and routing every change through edit() and publish() means no caller can skip the frozen check.',
    workflow: 'CandidateService.editManifesto calls m.edit(...). edit() first calls the private requireEditable(), which throws MANIFESTO_FROZEN once ManifestoFreezeListener has called freeze(). A database trigger enforces the same rule underneath.',
    viva: { q: 'How does Manifesto stop edits after voting opens, and why is requireEditable private?', a: 'Every mutator (edit, publish) calls requireEditable(), which throws when frozen is true. It is private because it is an internal rule, not part of the public interface, and callers cannot reach the fields directly.' },
    refs: [
      { file: B + 'candidate/Manifesto.java', symbol: 'Manifesto.edit / publish / freeze / requireEditable', role: 'Private state and guarded mutators', lang: 'java',
        range: ['private String vision;', 'private static boolean isBlank('],
        marks: [
          { at: 'private String vision;', note: 'State is private: no other class can assign it directly.' },
          { at: 'private boolean frozen;', note: 'The flag that the guarded methods consult.' },
          { at: 'public void edit(String vision', note: 'The only way to change the text from outside.' },
          { at: '        requireEditable();\n        this.vision', note: 'edit() checks the rule before touching any field.' },
          { at: 'public void freeze(Instant now) {', note: 'Freezing is also a method, so the frozen flag and frozenAt always change together.' },
          { at: 'private void requireEditable() {', note: 'A private helper: the rule lives inside the class.' },
          { at: 'throw ApiException.rule("MANIFESTO_FROZEN"', note: 'The object refuses the change itself.' },
        ] },
      { file: B + 'access/User.java', symbol: 'User fields and accessors', role: 'Immutable private state with read-only accessors', lang: 'java',
        range: ['private final long userId;', 'public String fullName() {'],
        marks: [
          { at: 'private final long userId;', note: 'private final: set once in the constructor, never changed, never visible directly.' },
          { at: 'public long userId() {', note: 'A read-only accessor; there is no setter, so a role object cannot be altered after the factory builds it.' },
        ] },
      { file: B + 'candidate/CandidateService.java', symbol: 'CandidateService.editManifesto', role: 'Caller goes through the method', lang: 'java',
        range: ['Manifesto m = manifestos.findByCandidateId(candidateId).orElseThrow();', 'return CandidateDtos.ManifestoView.of(m);'],
        marks: [
          { at: 'm.edit(request.vision()', note: 'The service cannot write m.vision; it must call edit(), which enforces the freeze.' },
        ] },
    ],
  },
  {
    id: 'abstraction', name: 'Abstraction', group: 'Core concepts', status: 'found',
    definition: 'Abstraction exposes what an object does and hides how it does it, usually through an interface or abstract class that callers depend on.',
    why: 'Candidate media may be stored on local disk in development or in Firebase Cloud Storage in the cloud. Callers only need store, load and provider, so they depend on the MediaStorage interface and never on a concrete storage class.',
    workflow: 'StorageConfig picks LocalMediaStorage or FirebaseMediaStorage from configuration. CandidateService.uploadMedia calls storage.store(...) and receives a StoredObject without knowing which provider wrote the bytes.',
    viva: { q: 'Why does CandidateService not mention LocalMediaStorage or FirebaseMediaStorage?', a: 'Because it is written against the MediaStorage abstraction (through the ValidatingMediaStorage decorator). The provider is chosen once in StorageConfig, so switching providers needs no change in the service.' },
    refs: [
      { file: B + 'candidate/storage/MediaStorage.java', symbol: 'interface MediaStorage', role: 'Abstract contract', lang: 'java',
        range: ['/** Abstraction over', '}\n}'],
        marks: [
          { at: 'public interface MediaStorage {', note: 'The abstraction: a contract with no implementation details.' },
          { at: 'StoredObject store(String key, byte[] content, String contentType);', note: 'Callers know only what storing does and what it returns.' },
          { at: 'String provider();', note: 'Even the provider name is reported through the contract.' },
        ] },
      { file: B + 'access/User.java', symbol: 'abstract class User', role: 'Abstract role contract', lang: 'java',
        range: ['public abstract class User {', 'public abstract List<String> dashboardSections();'],
        marks: [
          { at: 'public abstract RoleCode role();', note: 'Every role must say which role it is, but User does not decide how.' },
          { at: 'protected abstract Set<Permission> permissions();', note: 'The permission set is abstract: each subclass supplies its own.' },
          { at: 'public abstract String homePath();', note: 'Where the UI lands after login is an abstract decision.' },
        ] },
      { file: B + 'candidate/CandidateService.java', symbol: 'CandidateService.uploadMedia', role: 'Caller uses only the abstraction', lang: 'java',
        range: ['contentType = storage.validate(kind', 'MediaStorage.StoredObject stored = storage.store(key, bytes, contentType);'],
        marks: [
          { at: 'MediaStorage.StoredObject stored = storage.store(key, bytes, contentType);', note: 'The service stores bytes without knowing whether they go to disk or Firebase.' },
        ] },
    ],
  },
  {
    id: 'inheritance', name: 'Inheritance', group: 'Core concepts', status: 'found',
    definition: 'Inheritance lets a subclass reuse and extend a parent class (extends). The subclass is a kind of the parent and inherits its non-private members.',
    why: 'DigiVote has five roles that share identity data (user id, organization, email, name) and the can() permission check, but differ in permissions, home page and voting rules. The shared part lives once in User; each role extends it.',
    workflow: 'UserFactory builds an AuditorUser, CandidateUser, VoterUser, ElectionAdministratorUser or OrganizationOwnerUser per request. AccessControlService then calls inherited methods such as can() on whichever subclass it received.',
    viva: { q: 'What does AuditorUser inherit from User, and what does it add?', a: 'It inherits the identity fields, their accessors, can(), grantedPermissions() and administers(). It adds its own PERMISSIONS set and overrides role(), permissions(), homePath(), dashboardSections() and mayVote().' },
    refs: [
      { file: B + 'access/AuditorUser.java', symbol: 'AuditorUser extends User', role: 'Subclass', lang: 'java',
        range: ['/** Read-only inspector', 'return "/auditor";'],
        marks: [
          { at: 'public final class AuditorUser extends User {', note: 'extends makes AuditorUser a User: it can be used wherever a User is expected.' },
          { at: 'super(userId, organizationId, email, fullName);', note: 'The subclass passes identity data up to the parent constructor, which owns those fields.' },
        ] },
      { file: B + 'access/CandidateUser.java', symbol: 'CandidateUser.mayVote', role: 'Subclass reusing parent behaviour', lang: 'java',
        range: ['public final class CandidateUser extends User {', 'return super.mayVote(context);'],
        marks: [
          { at: 'public final class CandidateUser extends User {', note: 'Another role in the same hierarchy.' },
          { at: 'return super.mayVote(context);', note: 'super calls the inherited User.mayVote after adding a candidate-only check.' },
        ] },
      { file: B + 'result/PluralityCountingStrategy.java', symbol: 'PluralityCountingStrategy extends AbstractRankingStrategy', role: 'Second hierarchy: counting', lang: 'java',
        range: ['/** First-past-the-post', 'return CountingMethod.PLURALITY;'],
        marks: [
          { at: 'public class PluralityCountingStrategy extends AbstractRankingStrategy {', note: 'Inherits the shared ranking and tie policy from AbstractRankingStrategy.' },
        ] },
      { file: B + 'voting/BallotRejectedException.java', symbol: 'BallotRejectedException extends ApiException', role: 'Exception hierarchy', lang: 'java',
        range: ['/** A ballot refused', 'public SecurityEvent.Type getEventType() {'],
        marks: [
          { at: 'public class BallotRejectedException extends ApiException {', note: 'A specialised ApiException that also carries the security event type to record.' },
          { at: 'super(status, code, message);', note: 'Status, code and message are handled by the parent.' },
        ] },
      { file: F + 'crypto/keyTransparency.js', symbol: 'class KeyTransparencyError extends Error', role: 'Inheritance in the JavaScript frontend', lang: 'js',
        range: ['export class KeyTransparencyError extends Error {', 'throw new KeyTransparencyError(code, message);'],
        marks: [
          { at: 'export class KeyTransparencyError extends Error {', note: 'A JavaScript class extending the built-in Error, so it keeps message and stack and works with try/catch.' },
          { at: '    super(message);', note: 'The parent Error constructor must run before this is used.' },
          { at: 'this.code = code;', note: 'The subclass adds a machine-readable code such as KEY_SUBSTITUTED.' },
        ] },
    ],
  },
  {
    id: 'abstract-classes', name: 'Abstract classes', group: 'Core concepts', status: 'found',
    definition: 'An abstract class cannot be instantiated. It can hold fields and concrete methods, and declares abstract methods that every concrete subclass must implement.',
    why: 'User and AbstractRankingStrategy each hold real shared logic (identity fields and can(); the full ranking and tie policy) plus a few decisions left to subclasses. An interface alone could not hold the shared fields and constructor.',
    workflow: 'AbstractRankingStrategy.count runs for every result generation. It calls the abstract validateTotals and describe, which Plurality and Approval implement differently.',
    viva: { q: 'Why is AbstractRankingStrategy abstract but still implements CountingStrategy?', a: 'It implements count() for all ranking strategies but cannot know the method-specific total check or description, so validateTotals() and describe() are abstract. It is a partial implementation, so it cannot be instantiated.' },
    refs: [
      { file: B + 'access/User.java', symbol: 'abstract class User', role: 'Abstract parent with state', lang: 'java',
        range: ['public abstract class User {', 'public final boolean can(Permission permission) {'],
        marks: [
          { at: 'public abstract class User {', note: 'abstract: new User(...) is not allowed; only role subclasses exist.' },
          { at: 'protected User(long userId', note: 'An abstract class can still have a constructor, used by subclasses through super(...).' },
          { at: 'public abstract RoleCode role();', note: 'An abstract method: no body, every subclass must implement it.' },
        ] },
      { file: B + 'result/AbstractRankingStrategy.java', symbol: 'AbstractRankingStrategy', role: 'Abstract partial implementation', lang: 'java',
        range: ['public abstract class AbstractRankingStrategy implements CountingStrategy {', 'validateTotals(acceptedBallots, totalSelections, maxSelections);'],
        marks: [
          { at: 'public abstract class AbstractRankingStrategy implements CountingStrategy {', note: 'Abstract and implementing an interface: a shared base for ranking strategies.' },
          { at: 'protected abstract void validateTotals(', note: 'Left to each subclass: Plurality and Approval accept different totals.' },
          { at: 'protected abstract String describe();', note: 'Each subclass describes its own method in the result explanation.' },
          { at: 'validateTotals(acceptedBallots, totalSelections, maxSelections);', note: 'The concrete method calls the abstract one; the subclass version runs.' },
        ] },
    ],
  },
  {
    id: 'interfaces', name: 'Interfaces and implementations', group: 'Core concepts', status: 'found',
    definition: 'An interface is a contract of methods a class promises to provide (implements). Code can depend on the interface and accept any implementation.',
    why: 'Counting methods and election states are pluggable. CountingStrategy and ElectionState let services ask "count these tallies" or "may this election accept ballots?" without knowing the concrete class.',
    workflow: 'Spring collects every CountingStrategy bean into CountingStrategyRegistry. ResultService asks the registry for the election\'s method and calls count(). For states, ElectionStateMachine maps each status to an ElectionState object.',
    viva: { q: 'Name the interface, an implementation and a call site for counting in DigiVote.', a: 'CountingStrategy is the interface; AbstractRankingStrategy implements it and PluralityCountingStrategy/ApprovalCountingStrategy extend that; ResultService.generate calls strategies.forMethod(...).count(...).' },
    refs: [
      { file: B + 'result/CountingStrategy.java', symbol: 'interface CountingStrategy', role: 'Interface declaration', lang: 'java',
        range: ['/** Strategy pattern', 'Outcome count('],
        marks: [
          { at: 'public interface CountingStrategy {', note: 'The contract every counting algorithm fulfils.' },
          { at: 'CountingMethod method();', note: 'Each implementation names the method it handles.' },
          { at: 'Outcome count(', note: 'The operation callers depend on.' },
        ] },
      { file: B + 'result/AbstractRankingStrategy.java', symbol: 'implements CountingStrategy', role: 'Implementation', lang: 'java',
        range: ['public abstract class AbstractRankingStrategy implements CountingStrategy {', 'public final Outcome count('],
        marks: [
          { at: 'implements CountingStrategy', note: 'Promises to provide count() and method() (method() is supplied by the concrete subclasses).' },
          { at: 'public final Outcome count(', note: 'The interface method implemented with @Override.' },
        ] },
      { file: B + 'election/state/ElectionState.java', symbol: 'interface ElectionState (default methods)', role: 'Interface with default methods', lang: 'java',
        range: ['public interface ElectionState {', 'default boolean acceptsBallots() {'],
        marks: [
          { at: 'public interface ElectionState {', note: 'The contract for every lifecycle state.' },
          { at: 'Set<ElectionStatus> allowedTargets();', note: 'Abstract: every state must list its next states.' },
          { at: 'default boolean canTransitionTo(ElectionStatus target) {', note: 'A default method: shared behaviour written once in the interface.' },
          { at: 'default boolean acceptsBallots() {', note: 'Defaults to false; only VotingState overrides it to true.' },
        ] },
      { file: B + 'election/state/LifecycleStates.java', symbol: 'VotingState implements ElectionState', role: 'Implementation', lang: 'java',
        range: ['static final class VotingState implements ElectionState {', 'public boolean acceptsBallots() { return true; }'],
        marks: [
          { at: 'static final class VotingState implements ElectionState {', note: 'One concrete state.' },
          { at: 'public boolean acceptsBallots() { return true; }', note: 'Overrides the interface default: only during VOTING are ballots accepted.' },
        ] },
      { file: B + 'result/ResultService.java', symbol: 'ResultService.generate', role: 'Call site through the interface', lang: 'java',
        range: ['CountingStrategy strategy = strategies.forMethod(rule.getCountingMethod());', 'rule.getMaxSelections());'],
        marks: [
          { at: 'CountingStrategy strategy = strategies.forMethod(rule.getCountingMethod());', note: 'The variable is typed as the interface.' },
          { at: 'CountingStrategy.Outcome outcome = strategy.count(', note: 'The call goes through the interface to whichever implementation was configured.' },
        ] },
    ],
  },
  // ----------------------------------------------------------------------------- polymorphism group
  {
    id: 'method-overriding', name: 'Method overriding', group: 'Core concepts', status: 'found',
    definition: 'Overriding replaces an inherited method with a subclass version of the same signature. @Override asks the compiler to confirm a parent method is really being replaced.',
    why: 'Voting policy differs by role. The default User.mayVote allows anyone with CAST_VOTE; an auditor must never vote, and a candidate may be barred from their own contest. Each role overrides just the parts that differ.',
    workflow: 'EligibilityService.evaluate calls user.mayVote(...). For an AuditorUser it returns false; for a CandidateUser it applies the candidate rule and then defers to super.mayVote.',
    viva: { q: 'Show one override that replaces parent behaviour completely and one that extends it.', a: 'AuditorUser.mayVote returns false outright (replaces). CandidateUser.mayVote adds a candidate check then calls super.mayVote(context) (extends).' },
    refs: [
      { file: B + 'access/User.java', symbol: 'User.mayVote (parent version)', role: 'Method being overridden', lang: 'java',
        range: ['public boolean mayVote(VotingContext context) {', 'return !context.administersElection()'],
        marks: [
          { at: 'public boolean mayVote(VotingContext context) {', note: 'The default policy every role inherits.' },
          { at: 'if (!can(Permission.CAST_VOTE)) {', note: 'Roles without CAST_VOTE can never vote.' },
        ] },
      { file: B + 'access/AuditorUser.java', symbol: 'AuditorUser.mayVote', role: 'Override that replaces', lang: 'java',
        range: ['@Override\n    public RoleCode role()', 'return false;'],
        marks: [
          { at: 'public RoleCode role() {', note: 'Overrides the abstract role() to return AUDITOR.' },
          { at: 'return "/auditor";', note: 'Overridden homePath(): the auditor dashboard.' },
          { at: 'public boolean mayVote(VotingContext context) {', note: 'Same signature as User.mayVote, so this replaces it for auditors.' },
          { at: 'return false;', note: 'Auditors are read-only and never vote.' },
        ] },
      { file: B + 'access/CandidateUser.java', symbol: 'CandidateUser.mayVote', role: 'Override that extends', lang: 'java',
        range: ['/** A candidate votes like any voter', 'return super.mayVote(context);'],
        marks: [
          { at: '    @Override\n    public boolean mayVote', note: '@Override makes the compiler check this matches a parent method.' },
          { at: 'if (context.candidateInElection() && !context.candidatesMayVote()) {', note: 'Candidate-only rule added before the parent logic.' },
          { at: 'return super.mayVote(context);', note: 'Then reuses the inherited policy.' },
        ] },
      { file: B + 'crypto/Paillier.java', symbol: 'Paillier.PrivateKey.toString', role: 'Overriding an Object method', lang: 'java',
        range: ['public record PrivateKey(', 'return "Paillier.PrivateKey[redacted]";'],
        marks: [
          { at: 'public String toString() {', note: 'Overrides the record\'s generated toString so logs never print key material.' },
          { at: 'return "Paillier.PrivateKey[redacted]";', note: 'Security: a logged private key shows only this text.' },
        ] },
    ],
  },
  {
    id: 'method-overloading', name: 'Method overloading (compile-time polymorphism)', group: 'Core concepts', status: 'found',
    definition: 'Overloading defines several methods (or constructors) with the same name but different parameter lists. The compiler picks one from the argument types at compile time.',
    why: 'The same operation often has a convenient form and a precise form. UserFactory can build a role from database rows or from raw values; Paillier.encrypt can draw its own randomness or take the randomness a proof needs.',
    workflow: 'AccessControlService calls UserFactory.create(account, membership), which validates the pair and calls the other create(...). Ballot proofs call Paillier.encrypt with explicit randomness so they can prove facts about the ciphertext.',
    viva: { q: 'Why is overloading called compile-time polymorphism? Give a DigiVote example.', a: 'Because the compiler chooses the method from the static argument types before the program runs. Example: ElectionStateMachine.stateOf(ElectionStatus) and stateOf(Election), where the second delegates to the first.' },
    refs: [
      { file: B + 'access/UserFactory.java', symbol: 'UserFactory.create (two overloads)', role: 'Overloaded methods', lang: 'java',
        range: ['public User create(UserAccount account, Membership membership) {', 'case AUDITOR ->'],
        marks: [
          { at: 'public User create(UserAccount account, Membership membership) {', note: 'Overload 1: from persisted account and membership.' },
          { at: 'return create(membership.getRole(), account.getId()', note: 'Overload 1 calls overload 2; the compiler resolves which by argument types.' },
          { at: 'public User create(RoleCode role, long userId', note: 'Overload 2: same name, different parameters.' },
        ] },
      { file: B + 'crypto/Paillier.java', symbol: 'Paillier.encrypt (two overloads)', role: 'Overloaded methods', lang: 'java',
        range: ['public static BigInteger encrypt(PublicKey key, BigInteger m, SecureRandom random) {', 'public static BigInteger encrypt(PublicKey key, BigInteger m, BigInteger r) {'],
        marks: [
          { at: 'public static BigInteger encrypt(PublicKey key, BigInteger m, SecureRandom random) {', note: 'Takes a SecureRandom and draws fresh randomness.' },
          { at: 'return encrypt(key, m, randomUnit(key.n(), random));', note: 'Delegates to the overload that takes the randomness r.' },
          { at: 'public static BigInteger encrypt(PublicKey key, BigInteger m, BigInteger r) {', note: 'Same name; the third parameter is a BigInteger instead.' },
        ] },
      { file: B + 'election/state/ElectionStateMachine.java', symbol: 'ElectionStateMachine.stateOf (two overloads)', role: 'Overloaded methods', lang: 'java',
        range: ['public ElectionState stateOf(ElectionStatus status) {', 'return stateOf(election.getStatus());'],
        marks: [
          { at: 'public ElectionState stateOf(ElectionStatus status) {', note: 'By status value.' },
          { at: 'public ElectionState stateOf(Election election) {', note: 'By election entity.' },
        ] },
      { file: B + 'crypto/KeyVault.java', symbol: 'KeyVault constructors', role: 'Constructor overloading', lang: 'java',
        range: ['@org.springframework.beans.factory.annotation.Autowired', 'this.derivationKey ='],
        marks: [
          { at: 'public KeyVault(DigiVoteProperties properties) {', note: 'Constructor 1, used by Spring.' },
          { at: 'KeyVault(byte[] rawKey) {', note: 'Constructor 2: a raw key and no previous keys (package-private, used by tests).' },
          { at: 'KeyVault(byte[] rawKey, java.util.List<byte[]> previous) {', note: 'Constructor 3: does the real work.' },
        ] },
    ],
  },
  {
    id: 'runtime-polymorphism', name: 'Runtime polymorphism (dynamic dispatch)', group: 'Core concepts', status: 'found',
    definition: 'A variable declared with a parent type can hold any subclass object. A call on it runs the subclass\'s override, chosen at run time from the actual object.',
    why: 'Sign-in, eligibility and counting all work on the parent type (User, CountingStrategy, ElectionState). The same line of code behaves correctly for every role, counting method and election state without if/else chains.',
    workflow: 'At sign-in AuthService.me builds a User for each membership and calls role.homePath() and role.dashboardSections(), so each role lands on its own dashboard. EligibilityService calls user.mayVote(...) for the same reason.',
    viva: { q: 'In AuthService.me the variable role is of type User. Which homePath() runs for an auditor?', a: 'AuditorUser.homePath(), returning "/auditor". The JVM dispatches on the runtime class of the object the factory returned, not the declared type User.' },
    refs: [
      { file: B + 'auth/AuthService.java', symbol: 'AuthService.me', role: 'Dispatch at sign-in', lang: 'java',
        range: ['public AuthDtos.MeResponse me(UserAccount user) {', '.toList();'],
        marks: [
          { at: 'User role = userFactory.create(user, m);', note: 'Declared type User; the actual object is a role subclass.' },
          { at: 'role.homePath(),', note: 'Runs the subclass homePath(): /owner, /admin, /candidate, /voter or /auditor.' },
          { at: 'role.grantedPermissions(), role.dashboardSections()', note: 'Permissions and sections also come from the runtime class.' },
        ] },
      { file: B + 'voting/EligibilityService.java', symbol: 'EligibilityService.evaluate', role: 'Dispatch when checking a voter', lang: 'java',
        range: ['public Decision evaluate(Election election, User user) {', 'boolean open = stateMachine.stateOf(election).acceptsBallots()'],
        marks: [
          { at: 'public Decision evaluate(Election election, User user) {', note: 'Accepts any User subclass.' },
          { at: 'boolean roleAllows = user.mayVote(new User.VotingContext(', note: 'AuditorUser, CandidateUser or the default User.mayVote runs depending on the object.' },
          { at: 'boolean open = stateMachine.stateOf(election).acceptsBallots()', note: 'Polymorphism again: the current ElectionState object answers.' },
        ] },
      { file: B + 'access/AccessControlService.java', symbol: 'AccessControlService.operates', role: 'Dispatch in authorization', lang: 'java',
        range: ['public boolean operates(User user, Election election) {', 'return user.can(Permission.MANAGE_ELECTION) && user.administers(assigned);'],
        marks: [
          { at: 'user.administers(assigned)', note: 'Owner returns true, administrator returns whether assigned, others inherit false.' },
        ] },
    ],
  },
  // ------------------------------------------------------------------------- members and modifiers
  {
    id: 'access-modifiers', name: 'Access modifiers', group: 'Members and modifiers', status: 'found',
    definition: 'Java has four access levels: public (everywhere), protected (package and subclasses), package-private with no keyword (same package only) and private (same class only).',
    why: 'Roles must be created only by UserFactory, so the role constructors are package-private. Subclasses must provide permissions but outside code should ask can() instead, so permissions() is protected.',
    workflow: 'Code in com.digivote.auth or com.digivote.voting cannot write new AuditorUser(...); it must go through UserFactory (same package), which always matches the role to the stored membership.',
    viva: { q: 'Why are the role constructors package-private and User\'s constructor protected?', a: 'Package-private role constructors force creation through UserFactory in com.digivote.access. The protected User constructor can be called only by subclasses through super(...), never by other code.' },
    refs: [
      { file: B + 'access/User.java', symbol: 'User members', role: 'All four access levels in one class', lang: 'java',
        range: ['private final long userId;', 'public final Set<Permission> grantedPermissions() {'],
        marks: [
          { at: 'private final long userId;', note: 'private: only User itself can read the field.' },
          { at: 'protected User(long userId', note: 'protected constructor: only subclasses (and the package) can call it.' },
          { at: 'protected abstract Set<Permission> permissions();', note: 'protected: subclasses implement it; outside code calls can() instead.' },
          { at: 'public final boolean can(Permission permission) {', note: 'public: the API the rest of the backend uses.' },
        ] },
      { file: B + 'access/AuditorUser.java', symbol: 'AuditorUser constructor', role: 'Package-private constructor', lang: 'java',
        range: ['private static final Set<Permission> PERMISSIONS', 'super(userId, organizationId, email, fullName);'],
        marks: [
          { at: 'private static final Set<Permission> PERMISSIONS', note: 'private: the permission list is not visible outside the class.' },
          { at: '    AuditorUser(long userId', note: 'No modifier: package-private, callable only inside com.digivote.access.' },
        ] },
      { file: B + 'access/UserFactory.java', symbol: 'UserFactory', role: 'The one place allowed to construct roles', lang: 'java',
        range: ['* Factory pattern', 'case AUDITOR ->'],
        marks: [
          { at: 'Callers never instantiate role classes directly (their constructors are package-private).', note: 'The design intent, stated in the source comment.' },
          { at: 'case ORG_OWNER -> new OrganizationOwnerUser(', note: 'Allowed here because UserFactory is in the same package.' },
        ] },
    ],
  },
  {
    id: 'constructors', name: 'Constructors and object initialization', group: 'Members and modifiers', status: 'found',
    definition: 'A constructor runs when an object is created and puts it in a valid state. super(...) chains to the parent constructor and this(...) chains to another constructor of the same class.',
    why: 'Role objects need identity fields set exactly once; KeyVault needs its master key ring ready before any sealing; JPA entities need a no-argument constructor for loading rows plus a real constructor for new rows.',
    workflow: 'Spring creates KeyVault through its @Autowired constructor, which chains with this(...) to the constructor that builds the key ring. Every role subclass constructor chains to User\'s constructor with super(...).',
    viva: { q: 'What is constructor chaining? Show both kinds in DigiVote.', a: 'One constructor calling another first. this(...) in KeyVault(DigiVoteProperties) calls KeyVault(byte[], List). super(...) in AuditorUser\'s constructor calls the protected User constructor.' },
    refs: [
      { file: B + 'access/User.java', symbol: 'User constructor', role: 'Parent constructor', lang: 'java',
        range: ['protected User(long userId', 'this.fullName = fullName;'],
        marks: [
          { at: 'protected User(long userId', note: 'Runs for every role object.' },
          { at: 'this.userId = userId;', note: 'this.userId is the field; userId is the parameter.' },
        ] },
      { file: B + 'access/AuditorUser.java', symbol: 'AuditorUser constructor', role: 'super(...) chaining', lang: 'java',
        range: ['    AuditorUser(long userId', '    }'],
        marks: [
          { at: 'super(userId, organizationId, email, fullName);', note: 'Must be the first statement: the parent part of the object is initialised first.' },
        ] },
      { file: B + 'crypto/KeyVault.java', symbol: 'KeyVault constructors', role: 'this(...) chaining', lang: 'java',
        range: ['@org.springframework.beans.factory.annotation.Autowired', 'this.derivationKey ='],
        marks: [
          { at: 'this(loadKey(properties), previousKeys(properties));', note: 'Chains to the two-argument constructor after loading keys from configuration.' },
          { at: 'this(rawKey, java.util.List.of());', note: 'Chains with an empty list of previous keys.' },
          { at: 'this.masterKey = new SecretKeySpec(rawKey, "AES");', note: 'All chains end here, so initialisation is written once.' },
        ] },
      { file: B + 'candidate/Manifesto.java', symbol: 'Manifesto constructors', role: 'JPA no-arg plus real constructor', lang: 'java',
        range: ['protected Manifesto() {', 'this.updatedAt = now;'],
        marks: [
          { at: 'protected Manifesto() {', note: 'Required by JPA to load rows; protected so application code cannot create an empty manifesto.' },
          { at: 'public Manifesto(Long candidateId, Instant now) {', note: 'The constructor application code uses.' },
        ] },
      { file: F + 'crypto/keyTransparency.js', symbol: 'KeyTransparencyError constructor', role: 'JavaScript constructor with super', lang: 'js',
        range: ['export class KeyTransparencyError extends Error {', '  }\n}'],
        marks: [
          { at: '  constructor(code, message) {', note: 'The JavaScript constructor.' },
          { at: '    super(message);', note: 'Calls Error\'s constructor before setting this.code.' },
        ] },
    ],
  },
  {
    id: 'static-instance', name: 'Static and instance members', group: 'Members and modifiers', status: 'found',
    definition: 'Instance members belong to each object. Static members belong to the class and are shared by all objects; static methods have no this.',
    why: 'Every AuditorUser has the same permissions, so the set is a single static constant rather than a copy per object. Error construction and Paillier arithmetic need no object state, so they are static methods.',
    workflow: 'A role object is built on every request, but AuditorUser.PERMISSIONS is created once when the class loads. Services throw errors with ApiException.notFound("Election") without creating a factory object.',
    viva: { q: 'Why is PERMISSIONS static final in AuditorUser while userId is an instance field?', a: 'PERMISSIONS is the same for all auditors and never changes, so one shared constant suffices. userId differs per person, so each object holds its own.' },
    refs: [
      { file: B + 'access/AuditorUser.java', symbol: 'AuditorUser.PERMISSIONS', role: 'Static constant shared by all auditors', lang: 'java',
        range: ['private static final Set<Permission> PERMISSIONS', 'return PERMISSIONS;'],
        marks: [
          { at: 'private static final Set<Permission> PERMISSIONS', note: 'static: one set for the class; final: never reassigned.' },
          { at: 'return PERMISSIONS;', note: 'An instance method returning the shared static value.' },
        ] },
      { file: B + 'common/ApiException.java', symbol: 'ApiException static factories', role: 'Static factory methods', lang: 'java',
        range: ['private final HttpStatus status;', 'public static ApiException conflict('],
        marks: [
          { at: 'private final HttpStatus status;', note: 'Instance field: each exception has its own status.' },
          { at: 'public static ApiException notFound(String what) {', note: 'Static: called on the class, ApiException.notFound("Election").' },
        ] },
      { file: B + 'crypto/Paillier.java', symbol: 'Paillier utility class', role: 'Static-only class', lang: 'java',
        range: ['public final class Paillier {', '    }'],
        marks: [
          { at: 'private Paillier() {', note: 'A private constructor stops anyone creating a Paillier object; all its methods are static.' },
        ] },
      { file: B + 'crypto/KeyVault.java', symbol: 'KeyVault constants and static keyId', role: 'Static constants and method', lang: 'java',
        range: ['private static final Logger log', 'static String keyId(SecretKey key) {'],
        marks: [
          { at: 'private static final int IV_BYTES = 12;', note: 'A class-wide constant.' },
          { at: 'private final SecretKey masterKey;', note: 'Instance state: each KeyVault holds its own key.' },
          { at: 'static String keyId(SecretKey key) {', note: 'Static helper: works on its argument, no object state.' },
        ] },
    ],
  },
  {
    id: 'final', name: 'Final classes, methods and fields', group: 'Members and modifiers', status: 'found',
    definition: 'final on a class forbids subclassing, on a method forbids overriding, and on a field forbids reassignment after construction.',
    why: 'Security rules must not be bypassed by a subclass. can() is final so no role can redefine how permissions are checked; count() is final so a strategy cannot skip the shared consistency checks; role classes are final so nobody can extend AuditorUser into a voting auditor.',
    workflow: 'Every authorization check ends in User.can(), and every result in AbstractRankingStrategy.count(); final guarantees those exact implementations run.',
    viva: { q: 'Why is AbstractRankingStrategy.count final while validateTotals is abstract?', a: 'count is the fixed template that must always run the total check, ranking and tie policy. Only the method-specific step, validateTotals, may vary, so subclasses override that and cannot replace count.' },
    refs: [
      { file: B + 'access/User.java', symbol: 'User.can / grantedPermissions', role: 'final methods', lang: 'java',
        range: ['public final boolean can(Permission permission) {', 'return Collections.unmodifiableSet(permissions());'],
        marks: [
          { at: 'public final boolean can(Permission permission) {', note: 'final: subclasses supply permissions() but cannot change how they are checked.' },
          { at: 'return Collections.unmodifiableSet(permissions());', note: 'Callers get a read-only view; they cannot add permissions.' },
        ] },
      { file: B + 'result/AbstractRankingStrategy.java', symbol: 'AbstractRankingStrategy.count', role: 'final template method', lang: 'java',
        range: ['@Override\n    public final Outcome count(', 'validateTotals(acceptedBallots, totalSelections, maxSelections);'],
        marks: [
          { at: 'public final Outcome count(', note: 'final: Plurality and Approval cannot override the shared algorithm.' },
          { at: 'throw ApiException.conflict("TALLY_INCONSISTENT"', note: 'The check every subclass is guaranteed to run.' },
        ] },
      { file: B + 'access/VoterUser.java', symbol: 'final class VoterUser', role: 'final class', lang: 'java',
        range: ['public final class VoterUser extends User {', 'private static final Set<Permission> PERMISSIONS'],
        marks: [
          { at: 'public final class VoterUser extends User {', note: 'final class: no subclass can widen a voter\'s permissions.' },
        ] },
      { file: B + 'crypto/Paillier.java', symbol: 'final class Paillier', role: 'final utility class', lang: 'java',
        range: ['public final class Paillier {', 'private Paillier() {'],
        marks: [
          { at: 'public final class Paillier {', note: 'final with a private constructor: a non-extensible, non-instantiable utility class.' },
        ] },
    ],
  },
  {
    id: 'annotations', name: 'Annotations', group: 'Members and modifiers', status: 'found',
    definition: 'Annotations attach metadata to classes, methods, fields or parameters. The compiler (@Override) or frameworks (Spring, JPA) read them to change behaviour.',
    why: 'DigiVote relies on Spring Boot and JPA. Annotations declare which classes are beans, which methods handle HTTP routes, how entities map to tables, and which methods react to events, instead of writing that wiring by hand.',
    workflow: 'A request to GET /api/elections/{id}/voters reaches VotingController.voters because of @RestController, @RequestMapping and @GetMapping; @PathVariable and @RequestParam bind the URL values. DigiVote declares no custom annotation types (no @interface in the backend).',
    viva: { q: 'Name three annotation kinds DigiVote uses and who reads each.', a: '@Override is read by the compiler; @Entity/@Column/@Version by JPA (Hibernate) to map Manifesto to the manifestos table; @RestController/@GetMapping by Spring MVC to route requests.' },
    refs: [
      { file: B + 'voting/VotingController.java', symbol: 'VotingController', role: 'Spring web annotations', lang: 'java',
        range: ['@RestController', 'return eligibility.list(electionId, page, size);'],
        marks: [
          { at: '@RestController', note: 'Marks a Spring bean whose return values are written as JSON.' },
          { at: '@RequestMapping("/api/elections/{electionId}")', note: 'Base path for every route in the class.' },
          { at: '@GetMapping("/voters")', note: 'Maps GET .../voters to this method.' },
          { at: '@PathVariable Long electionId', note: 'Parameter annotation: binds the {electionId} URL segment.' },
        ] },
      { file: B + 'candidate/Manifesto.java', symbol: 'Manifesto mapping', role: 'JPA annotations', lang: 'java',
        range: ['@Entity', 'private long version;'],
        marks: [
          { at: '@Entity', note: 'Tells JPA this class maps to a table.' },
          { at: '@Table(name = "manifestos")', note: 'The table name.' },
          { at: '@GeneratedValue(strategy = GenerationType.IDENTITY)', note: 'The id is generated by the database.' },
          { at: '@Version', note: 'Optimistic locking: concurrent edits are detected.' },
        ] },
      { file: B + 'candidate/ManifestoFreezeListener.java', symbol: 'ManifestoFreezeListener.onTransition', role: 'Event annotation', lang: 'java',
        range: ['@Component', 'public void onTransition(ElectionLifecycleEvent event) {'],
        marks: [
          { at: '@Component', note: 'Registers the class as a Spring bean.' },
          { at: '@EventListener', note: 'Spring calls this method whenever an ElectionLifecycleEvent is published.' },
        ] },
    ],
  },
  // ------------------------------------------------------------------------------- relationships
  {
    id: 'composition-aggregation', name: 'Composition, aggregation and association', group: 'Relationships', status: 'found',
    definition: 'Association is any "uses/knows" link between classes. Aggregation is a has-a link where the part can exist on its own. Composition is a stronger has-a where the whole creates and owns its parts.',
    why: 'ElectionStateMachine creates its seven state objects itself and nobody else holds them (composition). CountingStrategyRegistry and ValidatingMediaStorage are handed objects that exist independently (aggregation). Entities refer to each other by id (association).',
    workflow: 'Every lifecycle check goes through the state objects owned by ElectionStateMachine; every upload passes through ValidatingMediaStorage to its delegate. Note: DigiVote entities do not use JPA @ManyToOne/@OneToMany; relationships are stored as foreign-key ids such as Manifesto.candidateId.',
    viva: { q: 'Is ElectionStateMachine to DraftState composition or aggregation? Why?', a: 'Composition: the machine creates each state with new in its own constructor and keeps them in a private map, so their lifetime is tied to the machine. The registry\'s strategies are aggregation because Spring creates them and passes them in.' },
    refs: [
      { file: B + 'election/state/ElectionStateMachine.java', symbol: 'ElectionStateMachine', role: 'Composition', lang: 'java',
        range: ['private final Map<ElectionStatus, ElectionState> states', 'states.put(state.status(), state);'],
        marks: [
          { at: 'private final Map<ElectionStatus, ElectionState> states', note: 'The parts are held privately.' },
          { at: 'register(new LifecycleStates.DraftState());', note: 'The whole creates its own parts: composition.' },
        ] },
      { file: B + 'result/CountingStrategyRegistry.java', symbol: 'CountingStrategyRegistry', role: 'Aggregation', lang: 'java',
        range: ['private final Map<CountingMethod, CountingStrategy> strategies', 'available.forEach(s -> strategies.put(s.method(), s));'],
        marks: [
          { at: 'public CountingStrategyRegistry(List<CountingStrategy> available) {', note: 'The strategies are created elsewhere (by Spring) and handed in: aggregation.' },
        ] },
      { file: B + 'candidate/storage/ValidatingMediaStorage.java', symbol: 'ValidatingMediaStorage.delegate', role: 'Has-a relationship', lang: 'java',
        range: ['private final MediaStorage delegate;', 'this.maxBytes = maxBytes;'],
        marks: [
          { at: 'private final MediaStorage delegate;', note: 'Has-a: the decorator holds the real storage object.' },
          { at: 'public ValidatingMediaStorage(MediaStorage delegate, long maxBytes) {', note: 'The part is supplied from outside (StorageConfig).' },
        ] },
      { file: B + 'election/ElectionAdministrator.java', symbol: 'ElectionAdministrator', role: 'Association by id', lang: 'java',
        range: ['@Entity', 'private Long assignedBy;'],
        marks: [
          { at: 'private Long electionId;', note: 'Links an election ...' },
          { at: 'private Long userId;', note: '... to a user: a many-to-many association stored as a join row of ids.' },
        ] },
    ],
  },
  {
    id: 'dependency-injection', name: 'Dependency injection', group: 'Relationships', status: 'found',
    definition: 'Dependency injection means an object receives its collaborators from outside (usually through the constructor) instead of creating them. A container such as Spring builds and supplies them.',
    why: 'Services depend on repositories, the factory, the clock and storage. Injection keeps them decoupled and testable: tests replace the Clock to simulate voting windows, and storage is chosen by configuration.',
    workflow: 'At start-up Spring creates beans: TimeConfig.clock() supplies a Clock, StorageConfig.mediaStorage() supplies the ValidatingMediaStorage, and constructors such as AccessControlService\'s receive them automatically.',
    viva: { q: 'Where does ManifestoFreezeListener get its Clock, and why not call Clock.systemUTC() directly?', a: 'Spring injects it through the constructor from the @Bean in TimeConfig. Injecting lets tests supply a fixed clock, and the whole app shares one UTC clock.' },
    refs: [
      { file: B + 'access/AccessControlService.java', symbol: 'AccessControlService constructor', role: 'Constructor injection', lang: 'java',
        range: ['private final UserRepository users;', 'this.organizations = organizations;'],
        marks: [
          { at: 'private final UserFactory userFactory;', note: 'A dependency stored as a final field.' },
          { at: 'public AccessControlService(UserRepository users', note: 'Spring calls this constructor and passes every bean it needs.' },
          { at: 'this.userFactory = userFactory;', note: 'The service never writes new UserFactory().' },
        ] },
      { file: B + 'config/TimeConfig.java', symbol: 'TimeConfig.clock', role: 'Where the dependency is configured', lang: 'java',
        range: ['@Configuration', 'return Clock.systemUTC();'],
        marks: [
          { at: '@Bean', note: 'The return value becomes an injectable bean.' },
          { at: 'return Clock.systemUTC();', note: 'One shared UTC clock for the whole application.' },
        ] },
      { file: B + 'candidate/ManifestoFreezeListener.java', symbol: 'ManifestoFreezeListener constructor', role: 'Receives the Clock', lang: 'java',
        range: ['private final CandidateRepository candidates;', 'this.clock = clock;'],
        marks: [
          { at: 'Clock clock) {', note: 'The Clock from TimeConfig arrives here.' },
        ] },
      { file: B + 'candidate/storage/StorageConfig.java', symbol: 'StorageConfig.mediaStorage', role: 'Bean factory method', lang: 'java',
        range: ['@Configuration', 'return new ValidatingMediaStorage(base, properties.storage().maxUploadBytes());'],
        marks: [
          { at: 'public ValidatingMediaStorage mediaStorage(DigiVoteProperties properties', note: 'Spring injects the properties into this @Bean method too.' },
          { at: 'return new ValidatingMediaStorage(base, properties.storage().maxUploadBytes());', note: 'The configured object CandidateService receives.' },
        ] },
      { file: B + 'result/CountingStrategyRegistry.java', symbol: 'CountingStrategyRegistry constructor', role: 'Injecting all implementations', lang: 'java',
        range: ['public CountingStrategyRegistry(List<CountingStrategy> available) {', 'available.forEach('],
        marks: [
          { at: 'public CountingStrategyRegistry(List<CountingStrategy> available) {', note: 'Spring injects every CountingStrategy bean as a list; adding a strategy needs no change here.' },
        ] },
    ],
  },
  {
    id: 'exception-handling', name: 'Exception handling', group: 'Relationships', status: 'found',
    definition: 'Exceptions signal errors. throw raises one, try/catch handles it, and a custom exception class carries domain information. Spring\'s @ExceptionHandler turns exceptions into HTTP responses.',
    why: 'A rejected ballot must roll back, be recorded as a security event, and give the client a clear code without leaking details. DigiVote uses a custom ApiException hierarchy plus a central handler for this.',
    workflow: 'BallotTransaction throws BallotRejectedException; BallotSubmissionService catches it, records the rejection, and rethrows; GlobalExceptionHandler converts the ApiException into an ErrorResponse with the right HTTP status. In the browser, CastBallot catches KeyTransparencyError and shows its code.',
    viva: { q: 'Why does BallotSubmissionService catch and then rethrow BallotRejectedException?', a: 'It needs to record the rejection (security and audit events, in their own transactions, after the ballot transaction rolled back), but the client must still get the rejection. So it handles the side effect and rethrows with throw e.' },
    refs: [
      { file: B + 'voting/BallotSubmissionService.java', symbol: 'BallotSubmissionService.submit', role: 'try / catch / rethrow / translate', lang: 'java',
        range: ['public VotingDtos.ReceiptView submit(', '"This credential has already been used to cast a ballot");'],
        marks: [
          { at: '        try {\n            return ballots.cast', note: 'The ballot is cast inside try.' },
          { at: '} catch (BallotRejectedException e) {', note: 'The most specific exception first.' },
          { at: '            throw e;', note: 'Rethrown after recording, so the client still sees the rejection.' },
          { at: '} catch (DataIntegrityViolationException e) {', note: 'A database UNIQUE violation means a duplicate vote ...' },
          { at: 'throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_VOTE",', note: '... translated into a domain error with a stable code.' },
        ] },
      { file: B + 'common/ApiException.java', symbol: 'ApiException', role: 'Custom exception base class', lang: 'java',
        range: ['public class ApiException extends RuntimeException {', 'this.code = code;'],
        marks: [
          { at: 'public class ApiException extends RuntimeException {', note: 'Unchecked custom exception carrying an HTTP status and code.' },
        ] },
      { file: B + 'common/GlobalExceptionHandler.java', symbol: 'GlobalExceptionHandler.handleApi', role: 'Central handler', lang: 'java',
        range: ['@RestControllerAdvice', 'return build(ex.getStatus(), ex.getCode(), ex.getMessage(), null);'],
        marks: [
          { at: '@RestControllerAdvice', note: 'Applies to every controller.' },
          { at: '@ExceptionHandler(ApiException.class)', note: 'Any ApiException (including BallotRejectedException) lands here.' },
        ] },
      { file: B + 'candidate/storage/LocalMediaStorage.java', symbol: 'LocalMediaStorage.store', role: 'Checked to unchecked wrapping', lang: 'java',
        range: ['public StoredObject store(', 'throw new UncheckedIOException("Could not store media", e);'],
        marks: [
          { at: '} catch (IOException e) {', note: 'Files.write throws the checked IOException.' },
          { at: 'throw new UncheckedIOException("Could not store media", e);', note: 'Wrapped so the MediaStorage interface need not declare throws; the cause is kept.' },
        ] },
      { file: F + 'pages/voter/CastBallot.jsx', symbol: 'CastBallot obtainCredential', role: 'Frontend try/catch', lang: 'js',
        range: ['const obtainCredential = async () => {', ": errorMessage(e, e.message));"],
        marks: [
          { at: 'const fingerprint = await verifyElectionCredentialKey(', note: 'May throw KeyTransparencyError.' },
          { at: '} catch (e) {', note: 'Catches any failure in the credential flow.' },
          { at: "setError(e?.code?.startsWith?.('KEY_')", note: 'KeyTransparencyError codes start with KEY_ and are shown with their code.' },
        ] },
    ],
  },
  // ---------------------------------------------------------------------------- language features
  {
    id: 'packages-modules', name: 'Packages, modules and namespaces', group: 'Language features', status: 'found',
    definition: 'Packages (Java) and ES modules (JavaScript) group related code, give names a namespace, and control visibility: package-private members, or only exported names in JS.',
    why: 'The backend is split by feature (access, election, voting, result, crypto ...). Package-private access is used on purpose: role constructors and LifecycleStates are visible only inside their package. The frontend uses ES modules with export/import.',
    workflow: 'com.digivote.access exposes User and UserFactory but hides role construction. In the browser, CastBallot.jsx imports only verifyElectionCredentialKey from crypto/keyTransparency.js; the private helper fail() is not exported.',
    viva: { q: 'How does the package structure protect the State pattern classes?', a: 'LifecycleStates is a package-private final class in com.digivote.election.state, so only ElectionStateMachine (same package) can create the state objects.' },
    refs: [
      { file: B + 'election/state/LifecycleStates.java', symbol: 'package com.digivote.election.state', role: 'Package and package-private class', lang: 'java',
        range: ['package com.digivote.election.state;', 'static final class DraftState implements ElectionState {'],
        marks: [
          { at: 'package com.digivote.election.state;', note: 'The namespace for lifecycle code.' },
          { at: 'final class LifecycleStates {', note: 'No public: visible only inside this package.' },
        ] },
      { file: F + 'crypto/keyTransparency.js', symbol: 'ES module exports', role: 'JavaScript module', lang: 'js',
        range: ["export const KEY_VERSION", 'const fail = (code, message) => {'],
        marks: [
          { at: "export const KEY_VERSION", note: 'Exported: other modules may import it.' },
          { at: "const PIN_KEY = 'digivote.credentialKeyPins';", note: 'Not exported: private to the module.' },
          { at: 'const fail = (code, message) => {', note: 'A module-private helper.' },
        ] },
      { file: F + 'pages/voter/CastBallot.jsx', symbol: 'import', role: 'Module import', lang: 'js',
        range: ["import { verifyElectionCredentialKey } from '../../crypto/keyTransparency.js';", "import { verifyElectionCredentialKey } from '../../crypto/keyTransparency.js';"],
        marks: [
          { at: "import { verifyElectionCredentialKey } from '../../crypto/keyTransparency.js';", note: 'Imports just one named export.' },
        ] },
    ],
  },
  {
    id: 'generics', name: 'Generics and type parameters', group: 'Language features', status: 'found',
    definition: 'Generics let a class or method work with a type supplied by the caller (List<T>, Map<K,V>), checked at compile time, without casts.',
    why: 'Paged API responses have the same shape for elections, voters and audit logs. PageResponse<T> is written once and reused with any item type. Repositories are typed with their entity and id types.',
    workflow: 'VotingController.voters returns PageResponse<VotingDtos.EligibleVoterView>; PageResponse.of maps a Spring Page<E> to it with a Function<E, T>. ElectionRepository extends JpaRepository<Election, Long>, so findById returns Optional<Election>.',
    viva: { q: 'In PageResponse.of, what are E and T?', a: 'E is the element type of the Spring Page (for example an entity), T is the view type sent to the client. The mapper Function<E, T> converts each element, and the compiler checks the types.' },
    refs: [
      { file: B + 'common/PageResponse.java', symbol: 'record PageResponse<T>', role: 'Generic type and generic method', lang: 'java',
        range: ['public record PageResponse<T>(', 'page.getNumber(), page.getSize()'],
        marks: [
          { at: 'public record PageResponse<T>(List<T> content', note: 'T is a type parameter: content is a list of whatever T is.' },
          { at: 'public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {', note: 'A generic method with its own type parameters E and T.' },
        ] },
      { file: B + 'election/ElectionRepository.java', symbol: 'ElectionRepository', role: 'Generic interface', lang: 'java',
        range: ['public interface ElectionRepository extends JpaRepository<Election, Long> {', 'Optional<ElectionStatus> currentStatus('],
        marks: [
          { at: 'extends JpaRepository<Election, Long>', note: 'Type arguments: the entity is Election and its id is Long.' },
          { at: 'Page<Election> findByOrganizationId(', note: 'Generic return types keep results typed.' },
        ] },
      { file: B + 'result/CountingStrategyRegistry.java', symbol: 'EnumMap<CountingMethod, CountingStrategy>', role: 'Generic collection', lang: 'java',
        range: ['private final Map<CountingMethod, CountingStrategy> strategies', 'private final Map<CountingMethod, CountingStrategy> strategies'],
        marks: [
          { at: 'private final Map<CountingMethod, CountingStrategy> strategies = new EnumMap<>(CountingMethod.class);', note: 'A typed map; the diamond <> infers the type arguments.' },
        ] },
    ],
  },
  {
    id: 'wrapper-classes', name: 'Wrapper classes', group: 'Language features', status: 'found',
    definition: 'Wrapper classes (Integer, Long, Boolean ...) box primitive values as objects. Unlike primitives they can be null, and they must be compared with equals() rather than ==.',
    why: 'DigiVote uses Long for entity ids and Integer where "no value" matters: Ballot.selectionCount is null for new ballots on purpose, because storing how many options a voter chose would leak information.',
    workflow: 'ResultService checks whether every accepted ballot has a non-null selectionCount before unboxing with mapToInt. UserFactory compares two Long ids with equals(), since == on boxed Longs compares references.',
    viva: { q: 'Why is Ballot.selectionCount an Integer and not an int?', a: 'An int cannot be null. New ballots deliberately store no selection count (privacy), so the column must be nullable and the field must be the Integer wrapper. ResultService checks for null before unboxing.' },
    refs: [
      { file: B + 'voting/Ballot.java', symbol: 'Ballot.selectionCount', role: 'Nullable wrapper field', lang: 'java',
        range: ['/** Historic rows only; not written for new ballots (would reveal', 'private Integer selectionCount;'],
        marks: [
          { at: 'private Integer selectionCount;', note: 'Integer, not int, so the value can be null.' },
        ] },
      { file: B + 'result/ResultService.java', symbol: 'ResultService.generate', role: 'Null check, then unboxing', lang: 'java',
        range: ['boolean allCounted = accepted.stream().allMatch(b -> b.getSelectionCount() != null);', 'int expectedSelections'],
        marks: [
          { at: 'b.getSelectionCount() != null', note: 'Only a wrapper can be compared with null.' },
          { at: 'mapToInt(Ballot::getSelectionCount)', note: 'Unboxing Integer to int; safe because nulls were ruled out first.' },
        ] },
      { file: B + 'access/UserFactory.java', symbol: 'UserFactory.create', role: 'equals() on Long', lang: 'java',
        range: ['if (!membership.getUserId().equals(account.getId())) {', 'throw new IllegalArgumentException('],
        marks: [
          { at: 'membership.getUserId().equals(account.getId())', note: 'Long values compared with equals(); == would compare object references.' },
        ] },
    ],
  },
  {
    id: 'object-class', name: 'java.lang.Object methods (equals, hashCode, toString)', group: 'Language features', status: 'found',
    definition: 'Every Java class inherits from Object. Classes override equals and hashCode together to define value equality, and toString to control their text form.',
    why: 'JPA needs a composite key class with value equality to find ElectionAdministrator rows by (electionId, userId). Paillier.PrivateKey overrides toString so key material can never appear in logs.',
    workflow: 'Spring Data uses ElectionAdministrator.Key in hash-based lookups through ElectionAdministratorRepository. Records such as User.VotingContext get equals/hashCode/toString generated automatically.',
    viva: { q: 'Why must equals and hashCode be overridden together in ElectionAdministrator.Key?', a: 'Equal keys must produce equal hash codes, or hash-based collections and the persistence context would treat the same (electionId, userId) as different keys.' },
    refs: [
      { file: B + 'election/ElectionAdministrator.java', symbol: 'ElectionAdministrator.Key', role: 'equals and hashCode', lang: 'java',
        range: ['public static class Key implements Serializable {', 'return Objects.hash(electionId, userId);'],
        marks: [
          { at: 'public boolean equals(Object o) {', note: 'Overrides Object.equals; the parameter type must be Object.' },
          { at: 'return o instanceof Key k && Objects.equals(electionId, k.electionId)', note: 'Pattern-matching instanceof, then field-by-field comparison.' },
          { at: 'return Objects.hash(electionId, userId);', note: 'Hash built from the same fields used in equals.' },
        ] },
      { file: B + 'crypto/Paillier.java', symbol: 'Paillier.PrivateKey.toString', role: 'toString', lang: 'java',
        range: ['public record PrivateKey(', 'return "Paillier.PrivateKey[redacted]";'],
        marks: [
          { at: 'return "Paillier.PrivateKey[redacted]";', note: 'Replaces the generated record toString that would print lambda and mu.' },
        ] },
    ],
  },
  {
    id: 'records', name: 'Records (immutable value objects)', group: 'Language features', status: 'found',
    definition: 'A Java record is a compact, immutable class whose fields are final and whose constructor, accessors, equals, hashCode and toString are generated.',
    why: 'Many DigiVote objects are plain data that must not change after creation: voting context, counting results, lifecycle events, API views. Records make that immutability the default.',
    workflow: 'EligibilityService builds a User.VotingContext and passes it to mayVote; ElectionLifecycleService publishes an ElectionLifecycleEvent record that listeners read with accessors like event.to().',
    viva: { q: 'What does the compiler generate for record ElectionLifecycleEvent?', a: 'Private final fields, a canonical constructor, accessors such as electionId() and to(), and equals, hashCode and toString based on all components.' },
    refs: [
      { file: B + 'election/state/ElectionLifecycleEvent.java', symbol: 'record ElectionLifecycleEvent', role: 'Record declaration', lang: 'java',
        range: ['/** Observer pattern', '}'],
        marks: [
          { at: 'public record ElectionLifecycleEvent(Long electionId', note: 'The components become final fields with accessors.' },
        ] },
      { file: B + 'access/User.java', symbol: 'record User.VotingContext', role: 'Nested record', lang: 'java',
        range: ['public record VotingContext(', 'boolean administratorsMayVote, boolean candidatesMayVote) {'],
        marks: [
          { at: 'public record VotingContext(boolean administersElection', note: 'An immutable bundle of election facts passed to mayVote.' },
        ] },
      { file: B + 'result/CountingStrategy.java', symbol: 'CountingStrategy records', role: 'Records nested in an interface', lang: 'java',
        range: ['record OptionTally(', 'record Outcome('],
        marks: [
          { at: 'record OptionTally(', note: 'One option\'s decrypted total.' },
          { at: 'record Outcome(', note: 'The immutable result of count().' },
        ] },
    ],
  },
  {
    id: 'enums', name: 'Enumerations', group: 'Language features', status: 'found',
    definition: 'An enum is a class with a fixed set of named instances. Enums are type-safe, work in switch, and have fast collections (EnumSet, EnumMap).',
    why: 'Roles, permissions, counting methods and election statuses are closed sets. Enums make invalid values impossible and let the factory switch over every role exhaustively.',
    workflow: 'UserFactory switches on RoleCode; role classes build their permission sets with EnumSet.of(Permission...); CountingStrategyRegistry keys an EnumMap by CountingMethod.',
    viva: { q: 'What happens in UserFactory if a sixth RoleCode is added but not handled?', a: 'The switch expression over an enum must be exhaustive, so the code stops compiling until the new role is handled.' },
    refs: [
      { file: B + 'organization/RoleCode.java', symbol: 'enum RoleCode', role: 'Enum declaration', lang: 'java',
        range: ['public enum RoleCode {', 'ORG_OWNER, ELECTION_ADMIN'],
        marks: [
          { at: 'ORG_OWNER, ELECTION_ADMIN, CANDIDATE, VOTER, AUDITOR', note: 'The five fixed roles.' },
        ] },
      { file: B + 'access/UserFactory.java', symbol: 'switch on RoleCode', role: 'Enum in a switch expression', lang: 'java',
        range: ['return switch (role) {', 'case AUDITOR ->'],
        marks: [
          { at: 'return switch (role) {', note: 'A switch expression that must cover every constant.' },
        ] },
      { file: B + 'access/ElectionAdministratorUser.java', symbol: 'EnumSet.of(Permission...)', role: 'EnumSet', lang: 'java',
        range: ['private static final Set<Permission> PERMISSIONS = EnumSet.of(', 'Permission.VIEW_AUDIT_LOGS, Permission.GENERATE_REPORTS, Permission.VIEW_REPORTS);'],
        marks: [
          { at: 'private static final Set<Permission> PERMISSIONS = EnumSet.of(', note: 'An EnumSet: a compact bit-set of Permission constants.' },
        ] },
    ],
  },
  {
    id: 'nested-classes', name: 'Nested and inner types', group: 'Language features', status: 'found',
    definition: 'A type declared inside another type. Static nested classes, nested enums and nested records belong to the outer type\'s namespace and do not capture an outer instance.',
    why: 'Types that only make sense together stay together: the seven state classes inside LifecycleStates, the composite Key inside ElectionAdministrator, Kind inside ValidatingMediaStorage, Status inside Manifesto.',
    workflow: 'ElectionStateMachine creates new LifecycleStates.VotingState(); JPA reads @IdClass(ElectionAdministrator.Key.class); CandidateService maps media types to ValidatingMediaStorage.Kind.',
    viva: { q: 'Why are the state classes static nested classes inside LifecycleStates?', a: 'They need no outer instance and are only used by the state machine. Nesting keeps all seven in one file and package-private, out of the public API.' },
    refs: [
      { file: B + 'election/state/LifecycleStates.java', symbol: 'LifecycleStates.DraftState', role: 'Static nested classes', lang: 'java',
        range: ['static final class DraftState implements ElectionState {', 'static final class RegistrationState implements ElectionState {'],
        marks: [
          { at: 'static final class DraftState implements ElectionState {', note: 'static nested: no reference to an outer LifecycleStates object.' },
        ] },
      { file: B + 'candidate/storage/ValidatingMediaStorage.java', symbol: 'ValidatingMediaStorage.Kind', role: 'Nested enum', lang: 'java',
        range: ['public enum Kind { IMAGE, PDF, VIDEO }', 'public enum Kind { IMAGE, PDF, VIDEO }'],
        marks: [
          { at: 'public enum Kind { IMAGE, PDF, VIDEO }', note: 'Referenced from outside as ValidatingMediaStorage.Kind.IMAGE.' },
        ] },
      { file: B + 'election/ElectionAdministrator.java', symbol: '@IdClass(ElectionAdministrator.Key.class)', role: 'Nested class used by JPA', lang: 'java',
        range: ['@IdClass(ElectionAdministrator.Key.class)', '@IdClass(ElectionAdministrator.Key.class)'],
        marks: [
          { at: '@IdClass(ElectionAdministrator.Key.class)', note: 'The nested Key class is the composite primary key.' },
        ] },
    ],
  },
  // ------------------------------------------------------------------------------ design patterns
  {
    id: 'factory', name: 'Factory pattern', group: 'Design patterns', status: 'found',
    definition: 'A factory centralises object creation and returns the right subclass for the input, so callers never use new on concrete classes.',
    why: 'The role object must always match the membership stored in the database. One factory guarantees that, and a role change takes effect on the next request.',
    workflow: 'AccessControlService.userInOrganization loads the account and active membership, then returns userFactory.create(account, membership). AuthService.me uses the same factory at sign-in.',
    viva: { q: 'Where is the Factory pattern applied, and why on every request?', a: 'UserFactory.create, called by AccessControlService and AuthService. Building per request means a role change by the owner applies immediately; nothing cached can grant old permissions.' },
    refs: [
      { file: B + 'access/UserFactory.java', symbol: 'UserFactory', role: 'The factory', lang: 'java',
        range: ['@Component', 'case AUDITOR ->'],
        marks: [
          { at: 'public User create(UserAccount account, Membership membership) {', note: 'The return type is the abstract User.' },
          { at: 'case VOTER -> new VoterUser(', note: 'The concrete subclass is chosen from the RoleCode.' },
        ] },
      { file: B + 'access/AccessControlService.java', symbol: 'AccessControlService.userInOrganization', role: 'Client of the factory', lang: 'java',
        range: ['public User userInOrganization(Long organizationId) {', 'return userFactory.create(account, membership);'],
        marks: [
          { at: 'return userFactory.create(account, membership);', note: 'The authorization boundary gets its role object from the factory.' },
        ] },
    ],
  },
  {
    id: 'strategy-template', name: 'Strategy and Template Method patterns', group: 'Design patterns', status: 'found',
    definition: 'Strategy makes an algorithm interchangeable behind an interface and picks it at run time. Template Method fixes an algorithm\'s skeleton in a base class and lets subclasses fill in steps.',
    why: 'Each election chooses its counting method in its rules. The registry picks the strategy from that persisted value; the shared ranking and tie policy is written once in AbstractRankingStrategy.',
    workflow: 'ResultService.generate calls strategies.forMethod(rule.getCountingMethod()).count(...). count() (template) calls validateTotals() and describe() (steps) on Plurality or Approval.',
    viva: { q: 'How would you add ranked-choice counting?', a: 'Add a CountingMethod constant and a new @Component implementing CountingStrategy. Spring injects it into CountingStrategyRegistry automatically; ResultService needs no change.' },
    refs: [
      { file: B + 'result/CountingStrategyRegistry.java', symbol: 'CountingStrategyRegistry.forMethod', role: 'Strategy selection', lang: 'java',
        range: ['public CountingStrategy forMethod(CountingMethod method) {', 'return strategy;'],
        marks: [
          { at: 'CountingStrategy strategy = strategies.get(method);', note: 'The algorithm is chosen from data at run time.' },
        ] },
      { file: B + 'result/ApprovalCountingStrategy.java', symbol: 'ApprovalCountingStrategy', role: 'Concrete strategy (template steps)', lang: 'java',
        range: ['public class ApprovalCountingStrategy extends AbstractRankingStrategy {', 'return "Approval: the candidate approved on the most ballots wins.";'],
        marks: [
          { at: 'protected void validateTotals(', note: 'Fills in the template step: approval allows 1..max selections per ballot.' },
          { at: 'protected String describe() {', note: 'Second step used in the explanation text.' },
        ] },
    ],
  },
  {
    id: 'state', name: 'State pattern', group: 'Design patterns', status: 'found',
    definition: 'The State pattern moves state-dependent behaviour into one object per state, so the context asks its current state instead of switching on a status value.',
    why: 'Which operations are open (manifesto edits, ballots, results) depends on the election\'s lifecycle stage. Each state class lists its own rules and allowed next states.',
    workflow: 'CandidateService checks state(election).allowsManifestoEdits() before an edit; ElectionStateMachine.requireTransition(from, to) asks the current state canTransitionTo(target).',
    viva: { q: 'Why is the State pattern better here than if (status == VOTING)?', a: 'Each state\'s rules live in one class, so adding a state means adding a class rather than editing many if/switch chains, and services cannot forget a check.' },
    refs: [
      { file: B + 'election/state/ElectionStateMachine.java', symbol: 'ElectionStateMachine.requireTransition', role: 'Context asking the state', lang: 'java',
        range: ['public void requireTransition(ElectionStatus from, ElectionStatus to) {', 'throw ApiException.conflict("INVALID_TRANSITION"'],
        marks: [
          { at: 'if (!stateOf(from).canTransitionTo(to)) {', note: 'The current state object decides if the move is legal.' },
        ] },
      { file: B + 'election/state/LifecycleStates.java', symbol: 'DraftState / RegistrationState', role: 'Concrete states', lang: 'java',
        range: ['static final class DraftState implements ElectionState {', 'public boolean allowsVoterListChanges() { return true; }\n    }\n\n    static final class CampaignState'],
        marks: [
          { at: 'public Set<ElectionStatus> allowedTargets() { return Set.of(ElectionStatus.REGISTRATION); }', note: 'Draft can only move to Registration.' },
          { at: 'public boolean isVisibleToMembers() { return false; }', note: 'Drafts are hidden from ordinary members.' },
        ] },
      { file: B + 'candidate/CandidateService.java', symbol: 'CandidateService.editManifesto', role: 'Service consulting the state', lang: 'java',
        range: ['stateMachine.require(state(election).allowsManifestoEdits(), election, "edit manifestos");', 'stateMachine.require(state(election).allowsManifestoEdits(), election, "edit manifestos");'],
        marks: [
          { at: 'state(election).allowsManifestoEdits()', note: 'No status comparison: the state object answers.' },
        ] },
    ],
  },
  {
    id: 'observer', name: 'Observer pattern', group: 'Design patterns', status: 'found',
    definition: 'In the Observer pattern a subject publishes events and any number of observers react, without the subject knowing who they are.',
    why: 'Freezing manifestos and notifying members are reactions to a lifecycle change, not part of it. Publishing an event keeps ElectionLifecycleService small and lets reactions be added independently.',
    workflow: 'ElectionLifecycleService.transition publishes ElectionLifecycleEvent. ManifestoFreezeListener reacts inside the same transaction when voting opens; ElectionNotificationListener reacts after commit and sends notifications.',
    viva: { q: 'Why does the freeze listener use @EventListener but the notification listener @TransactionalEventListener(AFTER_COMMIT)?', a: 'The freeze must commit together with opening voting, so it runs inside the transaction. Notifications should go out only if the transition actually committed.' },
    refs: [
      { file: B + 'election/state/ElectionLifecycleService.java', symbol: 'ElectionLifecycleService.transition', role: 'Subject publishes', lang: 'java',
        range: ['events.publishEvent(new ElectionLifecycleEvent(', 'from, target, actor));'],
        marks: [
          { at: 'events.publishEvent(new ElectionLifecycleEvent(', note: 'The subject announces the transition; it does not know the listeners.' },
        ] },
      { file: B + 'candidate/ManifestoFreezeListener.java', symbol: 'ManifestoFreezeListener.onTransition', role: 'Observer 1', lang: 'java',
        range: ['@EventListener', 'manifestos.saveAll(all);'],
        marks: [
          { at: 'if (event.to() != ElectionStatus.VOTING) {', note: 'Reacts only when voting opens.' },
          { at: 'all.forEach(m -> m.freeze(now));', note: 'Freezes every manifesto of the election.' },
        ] },
      { file: B + 'notification/ElectionNotificationListener.java', symbol: 'ElectionNotificationListener.onTransition', role: 'Observer 2', lang: 'java',
        range: ['@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)', 'switch (e.to()) {'],
        marks: [
          { at: '@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)', note: 'Runs only after the transition committed.' },
        ] },
    ],
  },
  {
    id: 'decorator', name: 'Decorator pattern', group: 'Design patterns', status: 'found',
    definition: 'A decorator implements the same interface as the object it wraps and adds behaviour before or after delegating to it.',
    why: 'Upload validation (allow-list, magic-byte check, size limit) must apply to every storage provider. Wrapping keeps it in one place without changing LocalMediaStorage or FirebaseMediaStorage.',
    workflow: 'StorageConfig wraps the chosen provider in ValidatingMediaStorage; CandidateService.uploadMedia calls validate() then store(), which delegates to the wrapped provider.',
    viva: { q: 'What makes ValidatingMediaStorage a decorator rather than a subclass?', a: 'It implements MediaStorage and holds another MediaStorage (delegate), forwarding store/load to it. It works with any provider instead of extending one specific class.' },
    refs: [
      { file: B + 'candidate/storage/ValidatingMediaStorage.java', symbol: 'ValidatingMediaStorage', role: 'Decorator', lang: 'java',
        range: ['public class ValidatingMediaStorage implements MediaStorage {', 'return delegate.load(key);'],
        marks: [
          { at: 'public class ValidatingMediaStorage implements MediaStorage {', note: 'Same interface as the wrapped object.' },
          { at: 'if (!ALLOWED.get(kind).contains(type) || !matchesSignature(type, content)) {', note: 'Added behaviour: type and magic-byte checks.' },
          { at: 'return delegate.store(key, content, contentType);', note: 'Forwards the real work to the wrapped storage.' },
        ] },
      { file: B + 'candidate/storage/StorageConfig.java', symbol: 'StorageConfig.mediaStorage', role: 'Where the decorator wraps a provider', lang: 'java',
        range: ['MediaStorage base;', 'return new ValidatingMediaStorage(base, properties.storage().maxUploadBytes());'],
        marks: [
          { at: 'base = new LocalMediaStorage(Path.of(properties.localDir(), "media"));', note: 'The plain provider ...' },
          { at: 'return new ValidatingMediaStorage(base, properties.storage().maxUploadBytes());', note: '... wrapped by the decorator.' },
        ] },
    ],
  },
  {
    id: 'singleton', name: 'Singleton', group: 'Design patterns', status: 'indirect',
    definition: 'A singleton guarantees one instance of a class. The classic form is a private constructor with a static getInstance().',
    why: 'DigiVote has no hand-written getInstance(). Single instances come from Spring: beans such as KeyVault, AuditService and the HikariCP connection pool are singleton-scoped by default. This is an architectural relationship, not a Singleton class in the source.',
    workflow: 'Spring creates one KeyVault and injects the same instance everywhere. docs/OOP_DESIGN_AND_PATTERNS.md names the DataSource pool as the connection-manager singleton; that is configured in application.yml, which this explorer does not publish.',
    viva: { q: 'Is there a Singleton class in DigiVote?', a: 'Not in the classic sense. The container enforces one instance per bean (singleton scope), for example KeyVault, so a getInstance() method would duplicate what Spring already guarantees.' },
    refs: [
      { file: B + 'crypto/KeyVault.java', symbol: '@Component KeyVault', role: 'Singleton-scoped Spring bean (indirect)', lang: 'java',
        range: ['@Component', 'public class KeyVault {'],
        marks: [
          { at: '@Component', note: 'Spring creates exactly one KeyVault by default (singleton scope); there is no static instance field.' },
        ] },
    ],
  },
  // --------------------------------------------------------------------------------- not found
  {
    id: 'multiple-inheritance', name: 'Multiple inheritance', group: 'Not found in DigiVote', status: 'absent',
    definition: 'A class inheriting from more than one parent. Java forbids it for classes but allows implementing several interfaces.',
    absent: 'No direct implementation found in the current DigiVote codebase. Every class extends at most one class, and no class implements more than one interface (checked by searching for "implements A, B").',
  },
  {
    id: 'custom-annotations', name: 'Custom annotation types', group: 'Not found in DigiVote', status: 'absent',
    definition: 'Declaring your own annotation with @interface.',
    absent: 'No direct implementation found in the current DigiVote codebase. The backend uses Java and Spring annotations but declares no @interface of its own.',
  },
  {
    id: 'serialization', name: 'Java serialization (ObjectOutputStream)', group: 'Not found in DigiVote', status: 'absent',
    definition: 'Writing objects to a byte stream with ObjectOutputStream and reading them back.',
    absent: 'No direct implementation found in the current DigiVote codebase. Only ElectionAdministrator.Key implements Serializable, because JPA requires it of @IdClass keys; DigiVote never serializes objects itself (it uses JSON through Jackson).',
  },
  {
    id: 'operator-overloading', name: 'Operator overloading', group: 'Not found in DigiVote', status: 'absent',
    definition: 'Giving operators such as + or == custom meaning for a type.',
    absent: 'No direct implementation found in the current DigiVote codebase. Java and JavaScript, the project\'s languages, do not support user-defined operator overloading.',
  },
  {
    id: 'cpp-features', name: 'C++ features (pointers, friend functions, virtual destructors, templates)', group: 'Not found in DigiVote', status: 'absent',
    definition: 'Language features specific to C++.',
    absent: 'No direct implementation found in the current DigiVote codebase. The repository contains no C++ files; its languages are Java, JavaScript/JSX and SQL.',
  },
  {
    id: 'typescript-interfaces', name: 'TypeScript interfaces and types', group: 'Not found in DigiVote', status: 'absent',
    definition: 'Compile-time type declarations in TypeScript.',
    absent: 'No direct implementation found in the current DigiVote codebase. The frontend is plain JavaScript and JSX; there are no .ts or .tsx files.',
  },
];
