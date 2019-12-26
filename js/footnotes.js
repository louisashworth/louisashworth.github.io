(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Don't run this JS if classList isn't supported
    if (!'classList' in document.body) return;

    // Find all footnote links and hook em up
    var footnotes = document.querySelectorAll('a.footnote');
    Array.prototype.forEach.call(footnotes, function (note) {
      var targetId = note.href.replace(/.*#/, '');
      if (!targetId) return;

      // Find the list element that has the matching ID
      var target = document.getElementById(targetId);
      if (!target) return;

      var footnoteParagraph = target.firstElementChild;
      if (!footnoteParagraph) return;

      // Find the closest paragraph to the footnote link.
      var parentParagraph = findParent("p", note);
      if (!parentParagraph) return;
      // Add a class to the footnote content paragraph so that it behaves
      // correctly when the associated foonote is clicked.
      footnoteParagraph.classList.add('footnote-content');
      // Add the footnote content paragrah adjacted to it.
      parentParagraph.insertAdjacentElement('afterend', footnoteParagraph);
      // We don't need the target list element any more...
      target.parentNode.removeChild(target);
      // ...but we can copy the ID over.
      footnoteParagraph.setAttribute('id', targetId);

      // When the note itself is clicked, toggle the "footnote-shown" class.
      note.addEventListener('click', function (event) {
        // This prevents the page jumping
        event.preventDefault();
        footnoteParagraph.classList.toggle('footnote-shown');
      });
    });
  });

  /**
   * Find a parent node that matches a particular tag name.
   *
   * For example:
       findParent("p", event.target);
   */
  function findParent(tagName, node) {
    if (node.parentNode) {
      if (node.parentNode.tagName.toLowerCase() === tagName) {
        return node.parentNode;
      } else {
        return findParent(tagName, node.parentNode);
      }
    }
  }
}());
