/* Generators: networks containing a DEPENDENT (controlled) source — the four types E/F/G/H,
   each reading a resistor elsewhere in the circuit. These are what the §4 "Circuits with
   dependent sources" page teaches: every one of them makes KCL's step 7 (constraint equations)
   and KVL's step 7 real content, and between them they hit the supernode, the supermesh and the
   known-current cases the lecture slides work through.

   Which of the four types lands in a given slot is random — a slot that must behave like a
   voltage source draws E or H, a slot that must behave like a current source draws F or G — so
   the same topology drills all four over a few presses, and the student has to read the symbol
   rather than recall the template. Gains are random too, so each generator wraps its build in
   Circuit.attempt(): a gain that cancels a loop's resistance leaves a singular circuit, and the
   only honest test for that is to solve the candidate (see Circuit.solvable).
   Resistors, independent sources and controlled sources, same registry and build() as every
   other family. See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  var DEP_ELEMENTS = ['R', 'V', 'I', 'W', 'E', 'F', 'G', 'H'];

  // Single loop: an independent source drives it, a controlled VOLTAGE source sits in series and
  // reads the first resistor. The smallest circuit in which a dependent source matters — one
  // mesh, one constraint, and KCL's supernode step stays quiet.
  //   n0 ─R─ n1
  //   V       R
  //   n3 ─E/H─ n2
  C.register('Dependent source (series)', function () {
    return C.attempt(function () {
      return C.build(
        [[0, 0], [2, 0], [2, 2], [0, 2]],
        [['V', 3, 0], ['R', 0, 1], ['R', 1, 2], [C.pickDepType('v'), 2, 3, undefined, 1]]
      );
    });
  }, { elements: DEP_ELEMENTS, tags: ['dependent-source', 'series'] });

  // Two meshes, the controlled voltage source on the right rail reading the top-left resistor.
  // Both loops need KVL; for KCL every node is reachable from the reference, so the work is all
  // in the constraint that expresses the control variable in node voltages.
  //   n0 ─R─ n1 ─R─ n2
  //   V      R      E/H
  //   n5 ─── n4 ─── n3
  C.register('Dependent + voltage source (dual loop)', function () {
    return C.attempt(function () {
      return C.build(
        [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]],
        [['V', 5, 0], ['R', 0, 1], ['R', 1, 4], ['R', 1, 2], [C.pickDepType('v'), 2, 3, undefined, 1],
          ['W', 3, 4], ['W', 4, 5]]
      );
    });
  }, { elements: DEP_ELEMENTS, tags: ['dependent-source', 'mesh'] });

  // The supernode case: a controlled VOLTAGE source floating between two non-reference nodes, so
  // neither node voltage is fixed and the pair has to be enclosed and solved together (KCL step
  // 5) with the source's own gain equation as the constraint (step 7).
  //   n0 ─R─ n1 ─E/H─ n2
  //   V      R        R
  //   n5 ─── n4 ───── n3
  C.register('Supernode (floating dependent source)', function () {
    return C.attempt(function () {
      return C.build(
        [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]],
        [['V', 5, 0], ['R', 0, 1], [C.pickDepType('v'), 1, 2, undefined, 1], ['R', 1, 4], ['R', 2, 3],
          ['W', 3, 4], ['W', 4, 5]]
      );
    });
  }, { elements: DEP_ELEMENTS, tags: ['dependent-source', 'supernode'] });

  // The supermesh case: a controlled CURRENT source on the branch two meshes share. Neither loop
  // can be walked on its own, so KVL walks the pair and the source's gain equation is the
  // constraint that links them (mesh steps 5 and 7).
  //   n0 ─R─ n1 ─R─ n2
  //   V      F/G     R
  //   n5 ─── n4 ─── n3
  C.register('Supermesh (shared dependent current source)', function () {
    return C.attempt(function () {
      return C.build(
        [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]],
        [['V', 5, 0], ['R', 0, 1], [C.pickDepType('i'), 1, 4, undefined, 1], ['R', 1, 2], ['R', 2, 3],
          ['W', 3, 4], ['W', 4, 5]]
      );
    });
  }, { elements: DEP_ELEMENTS, tags: ['dependent-source', 'supermesh', 'mesh'] });

  // All three special cases at once — the textbook layout (Nilsson & Riedel 4.51): an
  // independent current source on the left boundary hands mesh 1 over outright (step 3), a
  // controlled current source in the middle welds meshes 2 and 3 into a supermesh (step 5), and
  // a voltage source closes the right loop. Two constraints in step 7, one of them the gain.
  //   n0 ─R─ n1 ─R─ n2 ─R─ n3
  //   I      R      F/G     V
  //   n7 ─── n6 ─── n5 ─── n4
  C.register('Supermesh + known current + dependent (3 meshes)', function () {
    return C.attempt(function () {
      return C.build(
        [[0, 0], [2, 0], [4, 0], [6, 0], [6, 2], [4, 2], [2, 2], [0, 2]],
        [['I', 0, 7], ['R', 0, 1], ['R', 1, 6], ['R', 1, 2], [C.pickDepType('i'), 2, 5, undefined, 2],
          ['R', 2, 3], ['V', 3, 4], ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]],
        { flavour: false }   // the teaching point is exactly this arrangement of the three sources
      );
    });
  }, { elements: DEP_ELEMENTS, tags: ['dependent-source', 'supermesh', 'mesh'] });

})(window.Circuit);
